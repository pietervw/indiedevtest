"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  copyObject,
  createPresignedPutUrl,
  deleteObject,
  getObjectBytes,
  headObject,
} from "@/lib/storage";
import {
  enqueueObjectDeletions,
  settleObjectDeletions,
} from "@/lib/storage/deletion-outbox";
import {
  IMAGE_LIMITS,
  isAllowedImageContentType,
  validateImageByteSize,
  validateImageDimensions,
  type AllowedImageContentType,
} from "@/lib/storage/image-limits";
import {
  assertListingScreenshotKey,
  assertListingScreenshotPendingKey,
  finalKeyFromPendingKey,
  listingScreenshotPendingObjectKey,
} from "@/lib/storage/keys";
import { publicUrlForObjectKey } from "@/lib/storage/client";
import { requireDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { invalidatePublicCaches } from "@/lib/invalidate-public-caches";
import { appPath, editPath, screenshotsPath } from "@/lib/mock-data";
import {
  releaseRateLimit,
  takeRateLimit,
  type RateLimitReservation,
} from "@/lib/rate-limit";
import { imageSize } from "image-size";

/** Pending upload rows expire slightly after the presigned PUT URL (10 min). */
const PENDING_UPLOAD_TTL_MS = 15 * 60 * 1000;
/** Soft cap on new object keys minted per user per day (orphan / abuse valve). */
const PRESIGN_SLOT_LIMIT = 15;
const PRESIGN_SLOT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ListingScreenshotDto = {
  id: string;
  publicUrl: string;
  sortOrder: number;
  width: number;
  height: number;
  contentType: string;
};

export type UploadSlotRequest = {
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
};

export type UploadSlot = {
  objectKey: string;
  uploadUrl: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
};

export type ConfirmScreenshotInput = {
  objectKey: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
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

async function deleteObjectsBestEffort(objectKeys: string[]) {
  await Promise.all(
    objectKeys.map((key) => deleteObject(key).catch(() => undefined))
  );
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
    select: { objectKey: true },
  });
  const pendingKeys = pending.map((row) => row.objectKey);
  if (pendingKeys.length === 0) return;

  await deleteObjectsBestEffort(pendingKeys);
  await prisma.appListingScreenshotUpload
    .deleteMany({
      where: { appListingId: listingId, objectKey: { in: pendingKeys } },
    })
    .catch(() => undefined);
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

  const pending = await prisma.appListingScreenshotUpload.findMany({
    where: { appListingId: listingId, objectKey: { in: scopedKeys } },
    select: { objectKey: true },
  });
  await discardPendingUploads(
    listingId,
    pending.map((row) => row.objectKey)
  );
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

/** Drop expired pending rows and best-effort delete their R2 objects. */
async function purgeExpiredPendingUploads(listingId: string) {
  const expired = await prisma.appListingScreenshotUpload.findMany({
    where: { appListingId: listingId, expiresAt: { lte: new Date() } },
    select: { id: true, objectKey: true },
  });
  if (expired.length === 0) return;

  await prisma.appListingScreenshotUpload.deleteMany({
    where: { id: { in: expired.map((row) => row.id) } },
  });
  await deleteObjectsBestEffort(expired.map((row) => row.objectKey));
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
    await purgeExpiredPendingUploads(listingId);

    const [confirmedCount, pendingCount] = await Promise.all([
      prisma.appListingScreenshot.count({ where: { appListingId: listingId } }),
      prisma.appListingScreenshotUpload.count({
        where: { appListingId: listingId, expiresAt: { gt: new Date() } },
      }),
    ]);
    const remaining = IMAGE_LIMITS.maxFiles - confirmedCount - pendingCount;
    if (slots.length > remaining) {
      for (const reservation of reserved.reservations) {
        releaseRateLimit(reservation);
      }
      return {
        ok: false,
        message:
          remaining <= 0
            ? `You can add at most ${IMAGE_LIMITS.maxFiles} screenshots.`
            : `You can only add ${remaining} more screenshot${remaining === 1 ? "" : "s"}.`,
      };
    }

    const expiresAt = new Date(Date.now() + PENDING_UPLOAD_TTL_MS);
    const planned = slots.map((slot) => {
      const contentType = slot.contentType as AllowedImageContentType;
      return {
        slot,
        contentType,
        objectKey: listingScreenshotPendingObjectKey(listingId, contentType),
      };
    });
    mintedKeys.push(...planned.map((row) => row.objectKey));

    await prisma.appListingScreenshotUpload.createMany({
      data: planned.map((row) => ({
        appListingId: listingId,
        objectKey: row.objectKey,
        expiresAt,
      })),
    });

    const signed = await Promise.all(
      planned.map((row) =>
        createPresignedPutUrl({
          objectKey: row.objectKey,
          contentType: row.contentType,
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

  const heads = await Promise.all(
    items.map((item) => headObject(item.objectKey))
  );

  type Verified = ConfirmScreenshotInput & {
    publicUrl: string;
    finalKey: string;
    contentType: AllowedImageContentType;
  };
  const verified: Verified[] = [];
  const promotedFinalKeys: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const head = heads[i];
    if (!head) {
      await discardPendingUploads(listingId, objectKeys);
      await deleteObjectsBestEffort(promotedFinalKeys);
      return {
        ok: false,
        message: "Upload not found in storage. Please try again.",
      };
    }
    if (
      head.contentLength === undefined ||
      head.contentLength !== item.byteSize ||
      head.contentLength > IMAGE_LIMITS.maxBytes
    ) {
      await discardPendingUploads(listingId, objectKeys);
      await deleteObjectsBestEffort(promotedFinalKeys);
      return { ok: false, message: "Uploaded file size mismatch." };
    }
    if (!isAllowedImageContentType(item.contentType)) {
      await discardPendingUploads(listingId, objectKeys);
      await deleteObjectsBestEffort(promotedFinalKeys);
      return { ok: false, message: "Invalid image type." };
    }
    const expectedType = item.contentType.split(";")[0]!;
    if (
      head.contentType &&
      !head.contentType.toLowerCase().startsWith(expectedType.toLowerCase())
    ) {
      await discardPendingUploads(listingId, objectKeys);
      await deleteObjectsBestEffort(promotedFinalKeys);
      return { ok: false, message: "Uploaded file type mismatch." };
    }

    const bytes = await getObjectBytes(item.objectKey);
    if (!bytes || bytes.byteLength !== item.byteSize) {
      await discardPendingUploads(listingId, objectKeys);
      await deleteObjectsBestEffort(promotedFinalKeys);
      return {
        ok: false,
        message: "Upload not found in storage. Please try again.",
      };
    }

    let measured: { width?: number; height?: number };
    try {
      measured = imageSize(bytes);
    } catch {
      await discardPendingUploads(listingId, objectKeys);
      await deleteObjectsBestEffort(promotedFinalKeys);
      return { ok: false, message: "Could not read uploaded image dimensions." };
    }
    if (
      measured.width === undefined ||
      measured.height === undefined ||
      measured.width !== item.width ||
      measured.height !== item.height
    ) {
      await discardPendingUploads(listingId, objectKeys);
      await deleteObjectsBestEffort(promotedFinalKeys);
      return { ok: false, message: "Uploaded image dimensions mismatch." };
    }
    const dimError = validateImageDimensions(measured.width, measured.height);
    if (dimError) {
      await discardPendingUploads(listingId, objectKeys);
      await deleteObjectsBestEffort(promotedFinalKeys);
      return { ok: false, message: dimError };
    }

    const finalKey = finalKeyFromPendingKey(item.objectKey);
    if (!finalKey) {
      await discardPendingUploads(listingId, objectKeys);
      await deleteObjectsBestEffort(promotedFinalKeys);
      return { ok: false, message: "Invalid upload key." };
    }

    try {
      await copyObject({
        sourceKey: item.objectKey,
        destKey: finalKey,
        contentType: item.contentType,
      });
      promotedFinalKeys.push(finalKey);
    } catch (err) {
      console.error("[screenshots] promote failed", err);
      await discardPendingUploads(listingId, objectKeys);
      await deleteObjectsBestEffort(promotedFinalKeys);
      return { ok: false, message: "Could not finalize upload. Please try again." };
    }

    verified.push({
      ...item,
      contentType: item.contentType,
      byteSize: head.contentLength,
      finalKey,
      publicUrl: publicUrlForObjectKey(finalKey),
    });
  }

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
        select: { objectKey: true },
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
      await deleteObjectsBestEffort(
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

  // Drop temporary objects; final keys are immutable and no longer have a valid PUT URL.
  await deleteObjectsBestEffort(objectKeys);

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
  await settleObjectDeletions([shot.objectKey]);

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
