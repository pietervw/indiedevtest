"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AppCategory,
  AppListingStatus,
  Platform,
} from "@/generated/prisma";
import { requireDbUser } from "@/lib/auth-guards";
import { revokeBadgeBelowThreshold, syncFirst12Badge } from "@/lib/badges";
import { prisma } from "@/lib/db";
import { invalidatePublicCaches } from "@/lib/invalidate-public-caches";
import { isAllowedStatusTransition } from "@/lib/listing-status";
import { appPath, editPath, profilePath } from "@/lib/mock-data";
import { field, isHttpUrl } from "@/lib/validation";

export type UpdateListingState = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<
    Record<
      | "name"
      | "description"
      | "category"
      | "platform"
      | "logoUrl"
      | "testingAccessUrl"
      | "testerInstructions"
      | "testerCapacity"
      | "status"
      | "storeLink",
      string
    >
  >;
};

const CATEGORIES = new Set<string>(Object.values(AppCategory));
const PLATFORMS = new Set<string>(Object.values(Platform));
const STATUSES = new Set<string>(Object.values(AppListingStatus));

export async function updateAppListing(
  listingId: string,
  _prev: UpdateListingState,
  formData: FormData
): Promise<UpdateListingState> {
  const user = await requireDbUser();

  const listing = await prisma.appListing.findUnique({
    where: { id: listingId },
  });

  if (!listing || listing.userId !== user.id) {
    return { ok: false, message: "You can only edit your own listings." };
  }

  const name = field(formData, "name");
  const description = field(formData, "description");
  const category = field(formData, "category");
  const platform = field(formData, "platform");
  const logoUrl = field(formData, "logoUrl");
  const testingAccessUrl = field(formData, "testingAccessUrl");
  const testerInstructions = field(formData, "testerInstructions");
  const testerCapacityRaw = field(formData, "testerCapacity");
  const status = field(formData, "status");
  const storeLink = field(formData, "storeLink");

  const fieldErrors: UpdateListingState["fieldErrors"] = {};

  if (name.length < 2 || name.length > 80) {
    fieldErrors.name = "Name must be 2–80 characters.";
  }
  if (description.length < 20 || description.length > 2000) {
    fieldErrors.description = "Description must be 20–2000 characters.";
  }
  if (!CATEGORIES.has(category)) {
    fieldErrors.category = "Pick a category.";
  }
  if (!PLATFORMS.has(platform)) {
    fieldErrors.platform = "Pick a platform.";
  }
  if (logoUrl && !isHttpUrl(logoUrl)) {
    fieldErrors.logoUrl = "Logo must be an http(s) URL.";
  }
  if (testingAccessUrl && !isHttpUrl(testingAccessUrl)) {
    fieldErrors.testingAccessUrl = "Testing link must be an http(s) URL.";
  }
  if (testingAccessUrl.length > 500) {
    fieldErrors.testingAccessUrl = "Testing link must be 500 characters or fewer.";
  }
  if (testerInstructions.length > 2000) {
    fieldErrors.testerInstructions = "Instructions must be 2,000 characters or fewer.";
  }
  const testerCapacity = testerCapacityRaw ? Number(testerCapacityRaw) : null;
  if (
    testerCapacity !== null &&
    (!Number.isInteger(testerCapacity) || testerCapacity < 1 || testerCapacity > 10000)
  ) {
    fieldErrors.testerCapacity = "Tester capacity must be a whole number from 1 to 10,000.";
  }
  if (!STATUSES.has(status)) {
    fieldErrors.status = "Pick a valid status.";
  } else if (
    !isAllowedStatusTransition(
      listing.status,
      status as AppListingStatus
    )
  ) {
    fieldErrors.status =
      "That status change isn’t allowed. Follow Draft → Open → Closed (optional) → Testing Complete → Launched.";
  }

  if (status === "launched") {
    if (!storeLink) {
      fieldErrors.storeLink = "Store link is required when marking as Launched.";
    } else if (!isHttpUrl(storeLink)) {
      fieldErrors.storeLink = "Store link must be an http(s) URL.";
    }
  } else if (storeLink && !isHttpUrl(storeLink)) {
    fieldErrors.storeLink = "Store link must be an http(s) URL.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Fix the highlighted fields.", fieldErrors };
  }

  // Lock the listing so a concurrent acceptance cannot race past the capacity check.
  const capacityGate = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM app_listings WHERE id = ${listingId} FOR UPDATE`;
    const acceptedCount = await tx.testerRequest.count({
      where: { appListingId: listingId, status: "accepted" },
    });
    if (testerCapacity !== null && acceptedCount > testerCapacity) {
      return {
        ok: false as const,
        fieldErrors: {
          testerCapacity: `Capacity can't be below the ${acceptedCount} already accepted tester${acceptedCount === 1 ? "" : "s"}.`,
        },
      };
    }
    if (
      status === "open_for_testing" &&
      testerCapacity !== null &&
      acceptedCount >= testerCapacity
    ) {
      return {
        ok: false as const,
        fieldErrors: {
          status:
            "This program is full. Raise capacity or set status to Closed for testing.",
        },
      };
    }

    await tx.appListing.update({
      where: { id: listingId },
      data: {
        name,
        description,
        category: category as AppCategory,
        platform: platform as Platform,
        logoUrl: logoUrl || "",
        testingAccessUrl: testingAccessUrl || null,
        testerInstructions: testerInstructions || null,
        testerCapacity,
        status: status as AppListingStatus,
        storeLink:
          status === "launched"
            ? storeLink
            : storeLink || null,
      },
    });
    return { ok: true as const };
  });

  if (!capacityGate.ok) {
    return {
      ok: false,
      message: "Fix the highlighted fields.",
      fieldErrors: capacityGate.fieldErrors,
    };
  }

  revalidatePath("/browse");
  revalidatePath("/");
  revalidatePath(appPath(listingId));
  revalidatePath(editPath(listingId));
  invalidatePublicCaches({
    listingId,
    profileSlugs: user.profileSlug,
  });

  redirect(appPath(listingId));
}

/**
 * Owner deletes a listing. Spec §7:
 * - Cancel ongoing tests (rows cascade-delete with the listing)
 * - Revoke Completed credits; keep Joined credits
 * - Expire pending requests (cascade-delete)
 * - Reviews cascade-delete with the listing
 */
export async function deleteAppListing(listingId: string): Promise<void> {
  const user = await requireDbUser();

  const listing = await prisma.appListing.findUnique({
    where: { id: listingId },
    select: { id: true, userId: true },
  });

  if (!listing || listing.userId !== user.id) {
    redirect("/browse");
  }

  const testerSelect = {
    testerUserId: true,
    tester: { select: { profileSlug: true } },
  } as const;

  // Read counters inside the transaction so concurrent completes/reviews
  // can't be cascade-deleted without a matching decrement.
  const { completedAssignments, reviews } = await prisma.$transaction(
    async (tx) => {
      // Lock listing + all assignment rows so markComplete/Incomplete can't race.
      await tx.$executeRaw`SELECT 1 FROM app_listings WHERE id = ${listingId} FOR UPDATE`;
      await tx.$executeRaw`SELECT id FROM test_assignments WHERE app_listing_id = ${listingId} FOR UPDATE`;
      await tx.$executeRaw`SELECT id FROM reviews WHERE app_listing_id = ${listingId} FOR UPDATE`;

      const [completedAssignments, reviews] = await Promise.all([
        tx.testAssignment.findMany({
          where: { appListingId: listingId, status: "completed" },
          select: testerSelect,
        }),
        tx.review.findMany({
          where: { appListingId: listingId },
          select: testerSelect,
        }),
      ]);

      // One update (+ badge sync) per affected user — Prisma serializes
      // interactive-tx queries, so Promise.all wouldn't parallelize anyway.
      const completedByUser = new Map<string, number>();
      for (const assignment of completedAssignments) {
        completedByUser.set(
          assignment.testerUserId,
          (completedByUser.get(assignment.testerUserId) ?? 0) + 1
        );
      }
      const reviewsByUser = new Map<string, number>();
      for (const review of reviews) {
        reviewsByUser.set(
          review.testerUserId,
          (reviewsByUser.get(review.testerUserId) ?? 0) + 1
        );
      }

      const affectedUserIds = new Set([
        ...completedByUser.keys(),
        ...reviewsByUser.keys(),
      ]);
      for (const userId of affectedUserIds) {
        const completedDec = completedByUser.get(userId) ?? 0;
        const reviewDec = reviewsByUser.get(userId) ?? 0;
        const updated = await tx.user.update({
          where: { id: userId },
          data: {
            ...(completedDec > 0
              ? { profileScoreCompleted: { decrement: completedDec } }
              : {}),
            ...(reviewDec > 0
              ? { reviewsWrittenCount: { decrement: reviewDec } }
              : {}),
          },
          select: {
            profileScoreCompleted: true,
            reviewsWrittenCount: true,
          },
        });
        if (completedDec > 0) {
          await revokeBadgeBelowThreshold(
            tx,
            userId,
            "super_tester",
            updated.profileScoreCompleted
          );
        }
        if (reviewDec > 0) {
          await revokeBadgeBelowThreshold(
            tx,
            userId,
            "helpful_dev",
            updated.reviewsWrittenCount
          );
        }
      }

      await tx.appListing.delete({ where: { id: listingId } });
      if (completedAssignments.length > 0) {
        await syncFirst12Badge(tx, listing.userId);
      }
      return { completedAssignments, reviews };
    }
  );

  const affectedProfileSlugs = new Set([
    user.profileSlug,
    ...completedAssignments.map((a) => a.tester.profileSlug),
    ...reviews.map((r) => r.tester.profileSlug),
  ]);

  revalidatePath("/browse");
  revalidatePath("/");
  revalidatePath(appPath(listingId));
  for (const slug of affectedProfileSlugs) {
    revalidatePath(profilePath(slug));
  }
  // Explicit profile slugs — avoid clearing every profile cache.
  invalidatePublicCaches({
    listingId,
    profileSlugs: [...affectedProfileSlugs],
  });

  redirect(profilePath(user.profileSlug));
}
