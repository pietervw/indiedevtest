"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPresignedPutUrl,
  deleteObject,
  headObject,
} from "@/lib/storage";
import {
  IMAGE_LIMITS,
  isAllowedImageContentType,
  validateImageByteSize,
  validateImageDimensions,
  type AllowedImageContentType,
} from "@/lib/storage/image-limits";
import {
  assertListingScreenshotKey,
  listingScreenshotObjectKey,
} from "@/lib/storage/keys";
import { publicUrlForObjectKey } from "@/lib/storage/client";
import { requireDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { invalidatePublicCaches } from "@/lib/invalidate-public-caches";
import { appPath } from "@/lib/mock-data";
import {
  releaseRateLimit,
  takeRateLimit,
  type RateLimitReservation,
} from "@/lib/rate-limit";

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

async function discardPendingUploads(objectKeys: string[]) {
  if (objectKeys.length === 0) return;
  await deleteObjectsBestEffort(objectKeys);
  await prisma.appListingScreenshotUpload
    .deleteMany({ where: { objectKey: { in: objectKeys } } })
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
  await discardPendingUploads(pending.map((row) => row.objectKey));
  return { ok: true };
}

function revalidateListingScreenshots(
  listingId: string,
  profileSlug: string
) {
  invalidatePublicCaches({ listingId, profileSlugs: profileSlug });
  revalidatePath(appPath(listingId));
  revalidatePath(`/apps/${listingId}/edit`);
  revalidatePath(`/apps/${listingId}/screenshots`);
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
        objectKey: listingScreenshotObjectKey(listingId, contentType),
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
    await discardPendingUploads(mintedKeys);
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
      await discardPendingUploads(objectKeys);
      return { ok: false, message: error };
    }
    if (!assertListingScreenshotKey(listingId, item.objectKey)) {
      await discardPendingUploads(objectKeys);
      return { ok: false, message: "Invalid upload key." };
    }
  }

  const heads = await Promise.all(
    items.map((item) => headObject(item.objectKey))
  );

  const verified: Array<ConfirmScreenshotInput & { publicUrl: string }> = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const head = heads[i];
    if (!head) {
      await discardPendingUploads(objectKeys);
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
      await discardPendingUploads(objectKeys);
      return { ok: false, message: "Uploaded file size mismatch." };
    }
    const expectedType = item.contentType.split(";")[0]!;
    if (
      head.contentType &&
      !head.contentType.toLowerCase().startsWith(expectedType.toLowerCase())
    ) {
      await discardPendingUploads(objectKeys);
      return { ok: false, message: "Uploaded file type mismatch." };
    }
    verified.push({
      ...item,
      byteSize: head.contentLength,
      publicUrl: publicUrlForObjectKey(item.objectKey),
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
            objectKey: item.objectKey,
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
    await discardPendingUploads(objectKeys);
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

  if (
    orderedIds.length !== existingIds.size ||
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

  await prisma.appListingScreenshot.delete({ where: { id: shot.id } });
  await deleteObject(shot.objectKey).catch((err) => {
    console.error("[storage] failed to delete object", shot.objectKey, err);
  });

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
