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
import { appPath, profilePath } from "@/lib/mock-data";
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

  await prisma.appListing.update({
    where: { id: listingId },
    data: {
      name,
      description,
      category: category as AppCategory,
      platform: platform as Platform,
      logoUrl: logoUrl || "",
      status: status as AppListingStatus,
      storeLink:
        status === "launched"
          ? storeLink
          : storeLink || null,
    },
  });

  revalidatePath("/browse");
  revalidatePath("/");
  revalidatePath(appPath(listingId));
  revalidatePath(`/apps/${listingId}/edit`);
  invalidatePublicCaches({
    listingId,
    githubUsernames: user.githubUsername,
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
    tester: { select: { githubUsername: true } },
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

  const affectedUsernames = new Set([
    user.githubUsername,
    ...completedAssignments.map((a) => a.tester.githubUsername),
    ...reviews.map((r) => r.tester.githubUsername),
  ]);

  revalidatePath("/browse");
  revalidatePath("/");
  revalidatePath(appPath(listingId));
  for (const username of affectedUsernames) {
    revalidatePath(profilePath(username));
  }
  // Explicit usernames — avoid clearing every profile cache.
  invalidatePublicCaches({
    listingId,
    githubUsernames: [...affectedUsernames],
  });

  redirect(profilePath(user.githubUsername));
}
