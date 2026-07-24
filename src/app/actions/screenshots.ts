"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPresignedPutUrl,
} from "@/lib/storage";
import {
  enqueueObjectDeletions,
  settleObjectDeletions,
} from "@/lib/storage/deletion-outbox";
import {
  LISTING_IMAGE_LIMITS,
  isAllowedImageContentType,
  validateImageByteSize,
  validateImageDimensions,
  type AllowedImageContentType,
} from "@/lib/storage/image-limits";
import {
  assertListingScreenshotKey,
  assertListingScreenshotPendingKey,
  listingScreenshotPendingObjectKey,
} from "@/lib/storage/keys";
import type {
  ConfirmImageInput,
  UploadSlot,
  UploadSlotRequest,
  UploadedImageDto,
} from "@/lib/storage/upload-types";
import { verifyAndPromotePendingImages } from "@/lib/storage/verify-promote";
import { requireDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { invalidatePublicCaches } from "@/lib/invalidate-public-caches";
import { appPath, editPath, screenshotsPath } from "@/lib/mock-data";
import {
  releaseRateLimit,
  takeRateLimit,
  type RateLimitReservation,
} from "@/lib/rate-limit";

const IMAGE_LIMITS = LISTING_IMAGE_LIMITS;

/** Pending upload rows expire slightly after the presigned PUT URL (10 min). */
const PENDING_UPLOAD_TTL_MS = 15 * 60 * 1000;
/** Soft cap on new object keys minted per user per day (orphan / abuse valve). */
const PRESIGN_SLOT_LIMIT = 15;
const PRESIGN_SLOT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ListingScreenshotDto = UploadedImageDto;
export type ConfirmScreenshotInput = ConfirmImageInput;
// Avoid `export type { … }` re-exports here: Next.js 16.1+ registers them as
// server actions and throws ReferenceError at runtime (vercel/next.js#92461).


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

/** Enqueue then attempt delete so failed R2 removals still retry via cron. */
async function deleteObjectsWithOutbox(objectKeys: string[]) {
  const keys = [...new Set(objectKeys.filter((key) => key.length > 0))];
  if (keys.length === 0) return;
  await enqueueObjectDeletions(prisma, keys);
  try {
    await settleObjectDeletions(keys);
  } catch (error) {
    console.error(
      "[screenshots] object settlement failed; deferring to cron",
      error
    );
  }
}

async function discardPendingUploads(listingId: string, objectKeys: string[]) {
  // Only remove keys that are still pending — never delete confirmed screenshot objects.
  const scopedKeys = [
    ...new Set(
      objectKeys.filter((key) => assertListingScreenshotKey(listingId, key))
    ),
  ];
  if (scopedKeys.length === 0) return;

  const pending = await prisma.appListingScreenshotUpload.findMany({
    where: { appListingId: listingId, objectKey: { in: scopedKeys } },
    select: { objectKey: true, expiresAt: true },
  });
  if (pending.length === 0) return;

  const jobs = pending.map((row) => ({
    objectKey: row.objectKey,
    // Defer until the pending PUT URL can no longer succeed.
    notBefore: row.expiresAt,
  }));
  const pendingKeys = jobs.map((job) => job.objectKey);

  await prisma.$transaction(async (tx) => {
    await enqueueObjectDeletions(tx, jobs);
    await tx.appListingScreenshotUpload.deleteMany({
      where: { appListingId: listingId, objectKey: { in: pendingKeys } },
    });
  });

  try {
    await settleObjectDeletions(pendingKeys);
  } catch (error) {
    console.error(
      "[screenshots] pending upload settlement failed; deferring to cron",
      error
    );
  }
}

/** Drop minted-but-unconfirmed slots (e.g. after a failed client PUT). */
export async function cancelListingScreenshotUploads(
  listingId: string,
  objectKeys: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const owned = await requireOwnedListing(listingId);
  if (!owned.ok) {
    return { ok: false, message: owned.message };
  }

  if (!Array.isArray(objectKeys) || objectKeys.length === 0) {
    return { ok: true };
  }

  const scopedKeys = [
    ...new Set(
      objectKeys.filter((key) => assertListingScreenshotKey(listingId, key))
    ),
  ];
  if (scopedKeys.length === 0) {
    return { ok: true };
  }

  await discardPendingUploads(listingId, scopedKeys);
  return { ok: true };
}

function revalidateListingScreenshots(
  listingId: string,
  profileSlug: string
) {
  invalidatePublicCaches({ listingId, profileSlugs: profileSlug });
  revalidatePath(appPath(listingId));
  revalidatePath(editPath(listingId));
  revalidatePath(screenshotsPath(listingId));
}

async function requireOwnedListing(listingId: string) {
  const user = await requireDbUser();
  const listing = await prisma.appListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      userId: true,
      user: { select: { profileSlug: true, profileCompletedAt: true } },
    },
  });

  if (!listing || listing.userId !== user.id) {
    return { ok: false as const, message: "Listing not found." };
  }

  return { ok: true as const, user, listing };
}

function validateSlotRequest(slot: UploadSlotRequest): string | null {
  if (!isAllowedImageContentType(slot.contentType)) {
    return "Only JPEG, PNG, and WebP images are allowed.";
  }
  const sizeError = validateImageByteSize(slot.byteSize);
  if (sizeError) return sizeError;
  // Width/height are client-reported for layout; byte size + type are verified via R2.
  return validateImageDimensions(slot.width, slot.height);
}

/** Drop expired pending rows and enqueue their R2 objects for deletion. */
async function purgeExpiredPendingUploads(listingId: string) {
  const expired = await prisma.appListingScreenshotUpload.findMany({
    where: { appListingId: listingId, expiresAt: { lte: new Date() } },
    select: { objectKey: true },
  });
  if (expired.length === 0) return;
  await discardPendingUploads(
    listingId,
    expired.map((row) => row.objectKey)
  );
}

function reservePresignSlots(userId: string, count: number): {
  ok: true;
  reservations: RateLimitReservation[];
} | { ok: false; message: string } {
  const reservations: RateLimitReservation[] = [];
  for (let i = 0; i < count; i++) {
    const result = takeRateLimit({
      key: `screenshot-presign:${userId}`,
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

/** Create presigned PUT URLs for new listing screenshots (direct-to-R2). */
export async function createListingScreenshotUploadSlots(
  listingId: string,
  slots: UploadSlotRequest[]
): Promise<{ ok: true; slots: UploadSlot[] } | { ok: false; message: string }> {
  const owned = await requireOwnedListing(listingId);
  if (!owned.ok) {
    return { ok: false, message: owned.message };
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

  const reserved = reservePresignSlots(owned.user.id, slots.length);
  if (!reserved.ok) {
    return { ok: false, message: reserved.message };
  }

  const mintedKeys: string[] = [];
  try {
    // Best-effort before locking; expired rows are ignored by the count below.
    await purgeExpiredPendingUploads(listingId);

    const expiresAt = new Date(Date.now() + PENDING_UPLOAD_TTL_MS);
    const planned = slots.map((slot) => {
      const contentType = slot.contentType as AllowedImageContentType;
      return {
        slot,
        contentType,
        objectKey: listingScreenshotPendingObjectKey(listingId, contentType),
      };
    });

    // Count + insert under the listing lock so concurrent tabs can't exceed maxFiles.
    const reservedOk = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM app_listings WHERE id = ${listingId} FOR UPDATE`;

      const [confirmedCount, pendingCount] = await Promise.all([
        tx.appListingScreenshot.count({ where: { appListingId: listingId } }),
        tx.appListingScreenshotUpload.count({
          where: { appListingId: listingId, expiresAt: { gt: new Date() } },
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

      await tx.appListingScreenshotUpload.createMany({
        data: planned.map((row) => ({
          appListingId: listingId,
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
    await discardPendingUploads(listingId, mintedKeys);
    console.error("[screenshots] create upload slots failed", err);
    return { ok: false, message: "Could not start upload. Please try again." };
  }
}

/** After client PUT succeeds, verify objects in R2 and persist DB rows. */
export async function confirmListingScreenshots(
  listingId: string,
  items: ConfirmScreenshotInput[]
): Promise<
  | { ok: true; screenshots: ListingScreenshotDto[] }
  | { ok: false; message: string }
> {
  const owned = await requireOwnedListing(listingId);
  if (!owned.ok) {
    return { ok: false, message: owned.message };
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

  for (const item of items) {
    const error = validateSlotRequest(item);
    if (error) {
      await discardPendingUploads(listingId, objectKeys);
      return { ok: false, message: error };
    }
    if (!assertListingScreenshotPendingKey(listingId, item.objectKey)) {
      await discardPendingUploads(listingId, objectKeys);
      return { ok: false, message: "Invalid upload key." };
    }
  }

  const verifiedResult = await verifyAndPromotePendingImages(items, IMAGE_LIMITS);
  if (!verifiedResult.ok) {
    await discardPendingUploads(listingId, objectKeys);
    await deleteObjectsWithOutbox(verifiedResult.promotedFinalKeys);
    return { ok: false, message: verifiedResult.message };
  }
  const verified = verifiedResult.promoted;
  const promotedFinalKeys = verified.map((item) => item.finalKey);

  let created: ListingScreenshotDto[];
  try {
    created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM app_listings WHERE id = ${listingId} FOR UPDATE`;

      const pending = await tx.appListingScreenshotUpload.findMany({
        where: {
          appListingId: listingId,
          objectKey: { in: objectKeys },
          expiresAt: { gt: new Date() },
        },
        select: { objectKey: true, expiresAt: true },
      });
      if (pending.length !== objectKeys.length) {
        throw new PendingUploadError();
      }

      const existingCount = await tx.appListingScreenshot.count({
        where: { appListingId: listingId },
      });
      if (existingCount + verified.length > IMAGE_LIMITS.maxFiles) {
        throw new ScreenshotLimitError();
      }

      const maxOrder = await tx.appListingScreenshot.aggregate({
        where: { appListingId: listingId },
        _max: { sortOrder: true },
      });
      let nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

      const rows: ListingScreenshotDto[] = [];
      for (const item of verified) {
        const row = await tx.appListingScreenshot.create({
          data: {
            appListingId: listingId,
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

      await tx.appListingScreenshotUpload.deleteMany({
        where: { objectKey: { in: objectKeys } },
      });
      // Defer tmp deletes until the presigned PUT can no longer recreate the object.
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
    await discardPendingUploads(listingId, objectKeys);
    // Do not delete final keys that another concurrent confirm may have committed.
    if (promotedFinalKeys.length > 0) {
      const kept = await prisma.appListingScreenshot.findMany({
        where: {
          appListingId: listingId,
          objectKey: { in: promotedFinalKeys },
        },
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
          "Upload expired or was not started from this listing. Please try again.",
      };
    }
    console.error("[screenshots] confirm transaction failed", err);
    return { ok: false, message: "Could not save screenshots. Please try again." };
  }

  void settleObjectDeletions(objectKeys).catch((error) => {
    console.error(
      "[screenshots] tmp object settlement failed; deferring to cron",
      error
    );
  });

  revalidateListingScreenshots(listingId, owned.listing.user.profileSlug);
  return { ok: true, screenshots: created };
}

export async function reorderListingScreenshots(
  listingId: string,
  orderedIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const owned = await requireOwnedListing(listingId);
  if (!owned.ok) {
    return { ok: false, message: owned.message };
  }

  const existing = await prisma.appListingScreenshot.findMany({
    where: { appListingId: listingId },
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
      prisma.appListingScreenshot.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  revalidateListingScreenshots(listingId, owned.listing.user.profileSlug);
  return { ok: true };
}

export async function deleteListingScreenshot(
  listingId: string,
  screenshotId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const owned = await requireOwnedListing(listingId);
  if (!owned.ok) {
    return { ok: false, message: owned.message };
  }

  const shot = await prisma.appListingScreenshot.findFirst({
    where: { id: screenshotId, appListingId: listingId },
  });
  if (!shot) {
    return { ok: false, message: "Screenshot not found." };
  }

  await prisma.$transaction(async (tx) => {
    await enqueueObjectDeletions(tx, [shot.objectKey]);
    await tx.appListingScreenshot.delete({ where: { id: shot.id } });
  });
  try {
    await settleObjectDeletions([shot.objectKey]);
  } catch (error) {
    // Row is already gone; cron retries via the outbox.
    console.error(
      "[screenshots] object settlement failed; deferring to cron",
      error
    );
  }

  revalidateListingScreenshots(listingId, owned.listing.user.profileSlug);
  return { ok: true };
}

export async function finishListingScreenshotsStep(
  listingId: string
): Promise<void> {
  const owned = await requireOwnedListing(listingId);
  if (!owned.ok) {
    redirect("/browse");
  }

  const needsProfile = !owned.listing.user.profileCompletedAt;
  redirect(needsProfile ? "/onboarding/profile" : appPath(listingId));
}
