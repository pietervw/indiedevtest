"use server";

import { revalidatePath } from "next/cache";
import { createPresignedPutUrl } from "@/lib/storage";
import {
  enqueueObjectDeletions,
  settleObjectDeletions,
} from "@/lib/storage/deletion-outbox";
import {
  EVIDENCE_IMAGE_LIMITS,
  isAllowedImageContentType,
  validateImageByteSize,
  validateImageDimensions,
  type AllowedImageContentType,
} from "@/lib/storage/image-limits";
import {
  assertTestFeedbackKey,
  assertTestFeedbackPendingKey,
  testFeedbackPendingObjectKey,
} from "@/lib/storage/keys";
import type {
  ConfirmImageInput,
  UploadSlot,
  UploadSlotRequest,
  UploadedImageDto,
} from "@/lib/storage/upload-types";
import { verifyAndPromotePendingImages } from "@/lib/storage/verify-promote";
import { requireDbUser } from "@/lib/auth-guards";
import {
  awardBadgesAfterReviewWritten,
  revokeBadgeBelowThreshold,
  syncFirst12Badge,
} from "@/lib/badges";
import { prisma } from "@/lib/db";
import { invalidatePublicCaches } from "@/lib/invalidate-public-caches";
import {
  isCountedAssignmentStatus,
  isReviewableListingStatus,
} from "@/lib/listing-status";
import { appPath, editPath, profilePath } from "@/lib/mock-data";
import {
  releaseRateLimit,
  takeRateLimit,
  type RateLimitReservation,
} from "@/lib/rate-limit";
import {
  isCompleteEvidence,
  MIN_IMPROVEMENT_LENGTH,
  MAX_IMPROVEMENT_LENGTH,
} from "@/lib/test-evidence";

const IMAGE_LIMITS = EVIDENCE_IMAGE_LIMITS;
const PENDING_UPLOAD_TTL_MS = 15 * 60 * 1000;
const PRESIGN_SLOT_LIMIT = 30;
const PRESIGN_SLOT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type EvidenceScreenshotDto = UploadedImageDto;
export type ConfirmScreenshotInput = ConfirmImageInput;
export type { UploadSlot, UploadSlotRequest };

export type EvidenceState = {
  ok: boolean;
  message: string;
  fieldErrors?: { improvementSuggestion?: string };
};

export type TestEvidenceDto = {
  id: string;
  improvementSuggestion: string;
  createdAt: string;
  updatedAt: string;
  screenshots: EvidenceScreenshotDto[];
};

class ScreenshotLimitError extends Error {
  constructor() {
    super("SCREENSHOT_LIMIT");
    this.name = "ScreenshotLimitError";
  }
}

class PendingUploadError extends Error {
  constructor() {
    super("PENDING_UPLOAD");
    this.name = "PendingUploadError";
  }
}

async function deleteObjectsWithOutbox(objectKeys: string[]) {
  const keys = [...new Set(objectKeys.filter((key) => key.length > 0))];
  if (keys.length === 0) return;
  await enqueueObjectDeletions(prisma, keys);
  try {
    await settleObjectDeletions(keys);
  } catch (error) {
    console.error(
      "[test-evidence] object settlement failed; deferring to cron",
      error
    );
  }
}

function validateSlotRequest(slot: UploadSlotRequest): string | null {
  if (!isAllowedImageContentType(slot.contentType)) {
    return "Only JPEG, PNG, and WebP images are allowed.";
  }
  const sizeError = validateImageByteSize(slot.byteSize, IMAGE_LIMITS.maxBytes);
  if (sizeError) return sizeError;
  return validateImageDimensions(slot.width, slot.height, IMAGE_LIMITS);
}

function validateImprovementSuggestion(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < MIN_IMPROVEMENT_LENGTH) {
    return `Suggestions need at least ${MIN_IMPROVEMENT_LENGTH} characters.`;
  }
  if (trimmed.length > MAX_IMPROVEMENT_LENGTH) {
    return `Keep suggestions under ${MAX_IMPROVEMENT_LENGTH} characters.`;
  }
  return null;
}

async function discardPendingUploads(
  listingId: string,
  testerUserId: string,
  objectKeys: string[]
) {
  const scopedKeys = [
    ...new Set(
      objectKeys.filter((key) =>
        assertTestFeedbackKey(listingId, testerUserId, key)
      )
    ),
  ];
  if (scopedKeys.length === 0) return;

  const pending = await prisma.reviewScreenshotUpload.findMany({
    where: {
      appListingId: listingId,
      testerUserId,
      objectKey: { in: scopedKeys },
    },
    select: { objectKey: true, expiresAt: true },
  });
  if (pending.length === 0) return;

  const jobs = pending.map((row) => ({
    objectKey: row.objectKey,
    notBefore: row.expiresAt,
  }));
  const pendingKeys = jobs.map((job) => job.objectKey);

  await prisma.$transaction(async (tx) => {
    await enqueueObjectDeletions(tx, jobs);
    await tx.reviewScreenshotUpload.deleteMany({
      where: {
        appListingId: listingId,
        testerUserId,
        objectKey: { in: pendingKeys },
      },
    });
  });

  try {
    await settleObjectDeletions(pendingKeys);
  } catch (error) {
    console.error(
      "[test-evidence] pending upload settlement failed; deferring to cron",
      error
    );
  }
}

async function purgeExpiredPendingUploads(
  listingId: string,
  testerUserId: string
) {
  const expired = await prisma.reviewScreenshotUpload.findMany({
    where: {
      appListingId: listingId,
      testerUserId,
      expiresAt: { lte: new Date() },
    },
    select: { objectKey: true },
  });
  if (expired.length === 0) return;
  await discardPendingUploads(
    listingId,
    testerUserId,
    expired.map((row) => row.objectKey)
  );
}

function reservePresignSlots(
  userId: string,
  count: number
):
  | { ok: true; reservations: RateLimitReservation[] }
  | { ok: false; message: string } {
  const reservations: RateLimitReservation[] = [];
  for (let i = 0; i < count; i++) {
    const result = takeRateLimit({
      key: `evidence-presign:${userId}`,
      limit: PRESIGN_SLOT_LIMIT,
      windowMs: PRESIGN_SLOT_WINDOW_MS,
    });
    if (!result.allowed || !result.reservation) {
      for (const reservation of reservations) {
        releaseRateLimit(reservation);
      }
      return {
        ok: false,
        message: "Upload limit reached for today. Try again later.",
      };
    }
    reservations.push(result.reservation);
  }
  return { ok: true, reservations };
}

function revalidateEvidence(listingId: string, profileSlugs: string[]) {
  invalidatePublicCaches({ listingId, profileSlugs });
  revalidatePath(appPath(listingId));
  revalidatePath(editPath(listingId));
  for (const slug of profileSlugs) {
    revalidatePath(profilePath(slug));
  }
}

async function requireEvidenceEligibleTester(listingId: string) {
  const user = await requireDbUser();
  const listing = await prisma.appListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      status: true,
      userId: true,
      user: { select: { profileSlug: true } },
    },
  });

  if (!listing || !isReviewableListingStatus(listing.status)) {
    return {
      ok: false as const,
      message: "Test evidence isn't open for this listing right now.",
    };
  }
  if (listing.userId === user.id) {
    return {
      ok: false as const,
      message: "You can't submit evidence on your own app.",
    };
  }

  const assignment = await prisma.testAssignment.findUnique({
    where: {
      appListingId_testerUserId: {
        appListingId: listing.id,
        testerUserId: user.id,
      },
    },
    select: { status: true },
  });

  if (!assignment || !isCountedAssignmentStatus(assignment.status)) {
    return {
      ok: false as const,
      message:
        "You can submit evidence after the developer confirms you've joined testing.",
    };
  }

  return { ok: true as const, user, listing };
}

async function ensureReviewRow(
  listingId: string,
  testerUserId: string
): Promise<{ reviewId: string }> {
  const existing = await prisma.review.findUnique({
    where: {
      appListingId_testerUserId: {
        appListingId: listingId,
        testerUserId,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return { reviewId: existing.id };
  }

  try {
    const review = await prisma.review.create({
      data: {
        appListingId: listingId,
        testerUserId,
        improvementSuggestion: "",
      },
      select: { id: true },
    });
    return { reviewId: review.id };
  } catch {
    const raced = await prisma.review.findUnique({
      where: {
        appListingId_testerUserId: {
          appListingId: listingId,
          testerUserId,
        },
      },
      select: { id: true },
    });
    if (raced) {
      return { reviewId: raced.id };
    }
    throw new Error("Could not create test evidence draft.");
  }
}

export async function getMyTestEvidence(
  listingId: string
): Promise<TestEvidenceDto | null> {
  const user = await requireDbUser();
  const review = await prisma.review.findUnique({
    where: {
      appListingId_testerUserId: {
        appListingId: listingId,
        testerUserId: user.id,
      },
    },
    include: {
      screenshots: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          publicUrl: true,
          sortOrder: true,
          width: true,
          height: true,
          contentType: true,
        },
      },
    },
  });
  if (!review) return null;

  return {
    id: review.id,
    improvementSuggestion: review.improvementSuggestion,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    screenshots: review.screenshots,
  };
}

export async function cancelEvidenceScreenshotUploads(
  listingId: string,
  objectKeys: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const eligible = await requireEvidenceEligibleTester(listingId);
  if (!eligible.ok) {
    return { ok: false, message: eligible.message };
  }

  if (!Array.isArray(objectKeys) || objectKeys.length === 0) {
    return { ok: true };
  }

  const scopedKeys = [
    ...new Set(
      objectKeys.filter((key) =>
        assertTestFeedbackKey(listingId, eligible.user.id, key)
      )
    ),
  ];
  if (scopedKeys.length === 0) {
    return { ok: true };
  }

  await discardPendingUploads(listingId, eligible.user.id, scopedKeys);
  return { ok: true };
}

export async function createEvidenceScreenshotUploadSlots(
  listingId: string,
  slots: UploadSlotRequest[]
): Promise<{ ok: true; slots: UploadSlot[] } | { ok: false; message: string }> {
  const eligible = await requireEvidenceEligibleTester(listingId);
  if (!eligible.ok) {
    return { ok: false, message: eligible.message };
  }

  if (!Array.isArray(slots) || slots.length === 0) {
    return { ok: false, message: "No files selected." };
  }

  if (slots.length > IMAGE_LIMITS.maxFiles) {
    return {
      ok: false,
      message: `You can add at most ${IMAGE_LIMITS.maxFiles} screenshots.`,
    };
  }

  for (const slot of slots) {
    const error = validateSlotRequest(slot);
    if (error) return { ok: false, message: error };
  }

  const reserved = reservePresignSlots(eligible.user.id, slots.length);
  if (!reserved.ok) {
    return { ok: false, message: reserved.message };
  }

  const mintedKeys: string[] = [];
  try {
    await purgeExpiredPendingUploads(listingId, eligible.user.id);
    await ensureReviewRow(listingId, eligible.user.id);

    const expiresAt = new Date(Date.now() + PENDING_UPLOAD_TTL_MS);
    const planned = slots.map((slot) => {
      const contentType = slot.contentType as AllowedImageContentType;
      return {
        slot,
        contentType,
        objectKey: testFeedbackPendingObjectKey(
          listingId,
          eligible.user.id,
          contentType
        ),
      };
    });

    const reservedOk = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM app_listings WHERE id = ${listingId} FOR UPDATE`;

      const review = await tx.review.findUnique({
        where: {
          appListingId_testerUserId: {
            appListingId: listingId,
            testerUserId: eligible.user.id,
          },
        },
        select: { id: true },
      });
      if (!review) {
        return { ok: false as const, message: "Could not start upload." };
      }

      const [confirmedCount, pendingCount] = await Promise.all([
        tx.reviewScreenshot.count({ where: { reviewId: review.id } }),
        tx.reviewScreenshotUpload.count({
          where: {
            appListingId: listingId,
            testerUserId: eligible.user.id,
            expiresAt: { gt: new Date() },
          },
        }),
      ]);
      const remaining = IMAGE_LIMITS.maxFiles - confirmedCount - pendingCount;
      if (slots.length > remaining) {
        return {
          ok: false as const,
          message:
            remaining <= 0
              ? `You can add at most ${IMAGE_LIMITS.maxFiles} screenshots.`
              : `You can only add ${remaining} more screenshot${remaining === 1 ? "" : "s"}.`,
        };
      }

      await tx.reviewScreenshotUpload.createMany({
        data: planned.map((row) => ({
          appListingId: listingId,
          testerUserId: eligible.user.id,
          objectKey: row.objectKey,
          expiresAt,
        })),
      });
      return { ok: true as const };
    });

    if (!reservedOk.ok) {
      for (const reservation of reserved.reservations) {
        releaseRateLimit(reservation);
      }
      return { ok: false, message: reservedOk.message };
    }

    mintedKeys.push(...planned.map((row) => row.objectKey));

    const signed = await Promise.all(
      planned.map((row) =>
        createPresignedPutUrl({
          objectKey: row.objectKey,
          contentType: row.contentType,
          contentLength: row.slot.byteSize,
        })
      )
    );

    return {
      ok: true,
      slots: planned.map((row, index) => ({
        objectKey: signed[index]!.objectKey,
        uploadUrl: signed[index]!.uploadUrl,
        contentType: row.slot.contentType,
        byteSize: row.slot.byteSize,
        width: row.slot.width,
        height: row.slot.height,
      })),
    };
  } catch (err) {
    for (const reservation of reserved.reservations) {
      releaseRateLimit(reservation);
    }
    await discardPendingUploads(listingId, eligible.user.id, mintedKeys);
    console.error("[test-evidence] create upload slots failed", err);
    return { ok: false, message: "Could not start upload. Please try again." };
  }
}

export async function confirmEvidenceScreenshots(
  listingId: string,
  items: ConfirmScreenshotInput[]
): Promise<
  | { ok: true; screenshots: EvidenceScreenshotDto[] }
  | { ok: false; message: string }
> {
  const eligible = await requireEvidenceEligibleTester(listingId);
  if (!eligible.ok) {
    return { ok: false, message: eligible.message };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, message: "Nothing to confirm." };
  }

  if (items.length > IMAGE_LIMITS.maxFiles) {
    return {
      ok: false,
      message: `You can add at most ${IMAGE_LIMITS.maxFiles} screenshots.`,
    };
  }

  const objectKeys = items.map((item) => item.objectKey);
  const testerUserId = eligible.user.id;

  for (const item of items) {
    const error = validateSlotRequest(item);
    if (error) {
      await discardPendingUploads(listingId, testerUserId, objectKeys);
      return { ok: false, message: error };
    }
    if (!assertTestFeedbackPendingKey(listingId, testerUserId, item.objectKey)) {
      await discardPendingUploads(listingId, testerUserId, objectKeys);
      return { ok: false, message: "Invalid upload key." };
    }
  }

  const verifiedResult = await verifyAndPromotePendingImages(items, IMAGE_LIMITS);
  if (!verifiedResult.ok) {
    await discardPendingUploads(listingId, testerUserId, objectKeys);
    await deleteObjectsWithOutbox(verifiedResult.promotedFinalKeys);
    return { ok: false, message: verifiedResult.message };
  }
  const verified = verifiedResult.promoted;
  const promotedFinalKeys = verified.map((item) => item.finalKey);

  let created: EvidenceScreenshotDto[];
  try {
    created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM app_listings WHERE id = ${listingId} FOR UPDATE`;

      const review = await tx.review.findUnique({
        where: {
          appListingId_testerUserId: {
            appListingId: listingId,
            testerUserId,
          },
        },
        select: { id: true },
      });
      if (!review) {
        throw new PendingUploadError();
      }

      const pending = await tx.reviewScreenshotUpload.findMany({
        where: {
          appListingId: listingId,
          testerUserId,
          objectKey: { in: objectKeys },
          expiresAt: { gt: new Date() },
        },
        select: { objectKey: true, expiresAt: true },
      });
      if (pending.length !== objectKeys.length) {
        throw new PendingUploadError();
      }

      const existingCount = await tx.reviewScreenshot.count({
        where: { reviewId: review.id },
      });
      if (existingCount + verified.length > IMAGE_LIMITS.maxFiles) {
        throw new ScreenshotLimitError();
      }

      const maxOrder = await tx.reviewScreenshot.aggregate({
        where: { reviewId: review.id },
        _max: { sortOrder: true },
      });
      let nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

      const rows: EvidenceScreenshotDto[] = [];
      for (const item of verified) {
        const row = await tx.reviewScreenshot.create({
          data: {
            reviewId: review.id,
            objectKey: item.finalKey,
            publicUrl: item.publicUrl,
            sortOrder: nextOrder++,
            width: item.width,
            height: item.height,
            byteSize: item.byteSize,
            contentType: item.contentType,
          },
        });
        rows.push({
          id: row.id,
          publicUrl: row.publicUrl,
          sortOrder: row.sortOrder,
          width: row.width,
          height: row.height,
          contentType: row.contentType,
        });
      }

      await tx.reviewScreenshotUpload.deleteMany({
        where: { objectKey: { in: objectKeys } },
      });
      await enqueueObjectDeletions(
        tx,
        pending.map((row) => ({
          objectKey: row.objectKey,
          notBefore: row.expiresAt,
        }))
      );

      return rows;
    });
  } catch (err) {
    await discardPendingUploads(listingId, testerUserId, objectKeys);
    if (promotedFinalKeys.length > 0) {
      const kept = await prisma.reviewScreenshot.findMany({
        where: { objectKey: { in: promotedFinalKeys } },
        select: { objectKey: true },
      });
      const keptSet = new Set(kept.map((row) => row.objectKey));
      await deleteObjectsWithOutbox(
        promotedFinalKeys.filter((key) => !keptSet.has(key))
      );
    }
    if (err instanceof ScreenshotLimitError) {
      return {
        ok: false,
        message: `You can add at most ${IMAGE_LIMITS.maxFiles} screenshots.`,
      };
    }
    if (err instanceof PendingUploadError) {
      return {
        ok: false,
        message:
          "Upload expired or was not started for this listing. Please try again.",
      };
    }
    console.error("[test-evidence] confirm transaction failed", err);
    return {
      ok: false,
      message: "Could not save screenshots. Please try again.",
    };
  }

  void settleObjectDeletions(objectKeys).catch((error) => {
    console.error(
      "[test-evidence] tmp object settlement failed; deferring to cron",
      error
    );
  });

  revalidateEvidence(listingId, [
    eligible.user.profileSlug,
    eligible.listing.user.profileSlug,
  ]);
  return { ok: true, screenshots: created };
}

export async function reorderEvidenceScreenshots(
  listingId: string,
  orderedIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const eligible = await requireEvidenceEligibleTester(listingId);
  if (!eligible.ok) {
    return { ok: false, message: eligible.message };
  }

  const review = await prisma.review.findUnique({
    where: {
      appListingId_testerUserId: {
        appListingId: listingId,
        testerUserId: eligible.user.id,
      },
    },
    select: { id: true },
  });
  if (!review) {
    return { ok: false, message: "Evidence not found." };
  }

  const existing = await prisma.reviewScreenshot.findMany({
    where: { reviewId: review.id },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((row) => row.id));
  const uniqueOrderedIds = new Set(orderedIds);

  if (
    orderedIds.length !== existingIds.size ||
    uniqueOrderedIds.size !== orderedIds.length ||
    orderedIds.some((id) => !existingIds.has(id))
  ) {
    return { ok: false, message: "Invalid screenshot order." };
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.reviewScreenshot.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  revalidateEvidence(listingId, [
    eligible.user.profileSlug,
    eligible.listing.user.profileSlug,
  ]);
  return { ok: true };
}

export async function deleteEvidenceScreenshot(
  listingId: string,
  screenshotId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const eligible = await requireEvidenceEligibleTester(listingId);
  if (!eligible.ok) {
    return { ok: false, message: eligible.message };
  }

  const review = await prisma.review.findUnique({
    where: {
      appListingId_testerUserId: {
        appListingId: listingId,
        testerUserId: eligible.user.id,
      },
    },
    select: { id: true },
  });
  if (!review) {
    return { ok: false, message: "Screenshot not found." };
  }

  const shot = await prisma.reviewScreenshot.findFirst({
    where: { id: screenshotId, reviewId: review.id },
  });
  if (!shot) {
    return { ok: false, message: "Screenshot not found." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Serialize with markTestComplete's evidence gate (same review row lock).
      await tx.$executeRaw`
        SELECT id FROM reviews
        WHERE id = ${review.id}
        FOR UPDATE`;

      const locked = await tx.review.findUnique({
        where: { id: review.id },
        select: {
          improvementSuggestion: true,
          _count: { select: { screenshots: true } },
        },
      });
      if (!locked) {
        return;
      }

      const stillThere = await tx.reviewScreenshot.findFirst({
        where: { id: screenshotId, reviewId: review.id },
        select: { id: true },
      });
      if (!stillThere) {
        return;
      }

      const wasComplete = isCompleteEvidence({
        improvementSuggestion: locked.improvementSuggestion,
        screenshotCount: locked._count.screenshots,
      });

      await enqueueObjectDeletions(tx, [shot.objectKey]);
      await tx.reviewScreenshot.delete({ where: { id: shot.id } });

      if (!wasComplete) {
        return;
      }

      const stillComplete = isCompleteEvidence({
        improvementSuggestion: locked.improvementSuggestion,
        screenshotCount: locked._count.screenshots - 1,
      });
      if (stillComplete) {
        return;
      }

      const updated = await tx.user.update({
        where: { id: eligible.user.id },
        data: { reviewsWrittenCount: { decrement: 1 } },
        select: { reviewsWrittenCount: true },
      });
      await revokeBadgeBelowThreshold(
        tx,
        eligible.user.id,
        "helpful_dev",
        updated.reviewsWrittenCount
      );

      // Evidence is required to stay complete — revoke Completed credit if
      // the owner already marked this assignment done.
      const { count } = await tx.testAssignment.updateMany({
        where: {
          appListingId: listingId,
          testerUserId: eligible.user.id,
          status: "completed",
        },
        data: { status: "incomplete", completedAt: null },
      });
      if (count === 1) {
        const tester = await tx.user.update({
          where: { id: eligible.user.id },
          data: { profileScoreCompleted: { decrement: 1 } },
          select: { profileScoreCompleted: true },
        });
        await revokeBadgeBelowThreshold(
          tx,
          eligible.user.id,
          "super_tester",
          tester.profileScoreCompleted
        );
        await syncFirst12Badge(tx, eligible.listing.userId);
      }
    });
  } catch (err) {
    console.error("[test-evidence] deleteEvidenceScreenshot failed", err);
    return {
      ok: false,
      message: "Could not delete screenshot. Please try again.",
    };
  }

  try {
    await settleObjectDeletions([shot.objectKey]);
  } catch (error) {
    console.error(
      "[test-evidence] object settlement failed; deferring to cron",
      error
    );
  }

  revalidateEvidence(listingId, [
    eligible.user.profileSlug,
    eligible.listing.user.profileSlug,
  ]);
  return { ok: true };
}

/** Create or update the improvement suggestion; requires ≥4 screenshots for a complete submission. */
export async function saveTestEvidence(
  listingId: string,
  _prev: EvidenceState,
  formData: FormData
): Promise<EvidenceState> {
  const eligible = await requireEvidenceEligibleTester(listingId);
  if (!eligible.ok) {
    return { ok: false, message: eligible.message };
  }

  const improvementSuggestion = String(
    formData.get("improvementSuggestion") ?? ""
  ).trim();
  const suggestionError = validateImprovementSuggestion(improvementSuggestion);
  if (suggestionError) {
    return {
      ok: false,
      message: "Fix the suggestion below.",
      fieldErrors: { improvementSuggestion: suggestionError },
    };
  }

  const { reviewId } = await ensureReviewRow(listingId, eligible.user.id);

  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      improvementSuggestion: true,
      _count: { select: { screenshots: true } },
    },
  });
  if (!existing) {
    return { ok: false, message: "Could not save your evidence. Try again." };
  }

  const screenshotCount = existing._count.screenshots;
  if (screenshotCount < IMAGE_LIMITS.minFiles) {
    return {
      ok: false,
      message: `Upload at least ${IMAGE_LIMITS.minFiles} screenshots showing you used the app.`,
    };
  }

  const wasComplete = isCompleteEvidence({
    improvementSuggestion: existing.improvementSuggestion,
    screenshotCount,
  });
  const nowComplete = isCompleteEvidence({
    improvementSuggestion,
    screenshotCount,
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.review.update({
        where: { id: reviewId },
        data: { improvementSuggestion },
      });
      if (nowComplete && !wasComplete) {
        const updated = await tx.user.update({
          where: { id: eligible.user.id },
          data: { reviewsWrittenCount: { increment: 1 } },
          select: { reviewsWrittenCount: true },
        });
        await awardBadgesAfterReviewWritten(tx, {
          userId: eligible.user.id,
          reviewsWrittenCount: updated.reviewsWrittenCount,
        });
      }
    });
  } catch (err) {
    console.error("[test-evidence] saveTestEvidence failed", err);
    return {
      ok: false,
      message: "Could not save your evidence. Try again in a moment.",
    };
  }

  revalidateEvidence(listingId, [
    eligible.user.profileSlug,
    eligible.listing.user.profileSlug,
  ]);

  return {
    ok: true,
    message: wasComplete
      ? "Test evidence updated."
      : "Test evidence published — thanks for the feedback.",
  };
}
