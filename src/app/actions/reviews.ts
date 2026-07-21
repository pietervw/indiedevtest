"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth-guards";
import { awardBadgesAfterReviewWritten } from "@/lib/badges";
import { prisma } from "@/lib/db";
import { invalidatePublicCaches } from "@/lib/invalidate-public-caches";
import {
  isCountedAssignmentStatus,
  isReviewableListingStatus,
} from "@/lib/listing-status";
import { appPath, profilePath } from "@/lib/mock-data";

export type ReviewState = {
  ok: boolean;
  message: string;
  fieldErrors?: { content?: string };
};

const MIN_CONTENT = 10;
const MAX_CONTENT = 2000;

/**
 * Confirmed tester (joined assignment active/completed) writes a review.
 * Spec §8.4 — only after join confirm; wall only while open/closed.
 */
export async function createReview(
  listingId: string,
  _prev: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const user = await requireDbUser();

  const content = String(formData.get("content") ?? "").trim();
  if (content.length < MIN_CONTENT) {
    return {
      ok: false,
      message: "Write a bit more feedback.",
      fieldErrors: {
        content: `Reviews need at least ${MIN_CONTENT} characters.`,
      },
    };
  }
  if (content.length > MAX_CONTENT) {
    return {
      ok: false,
      message: "That review is too long.",
      fieldErrors: {
        content: `Keep reviews under ${MAX_CONTENT} characters.`,
      },
    };
  }

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
      ok: false,
      message: "Reviews aren't open for this listing right now.",
    };
  }
  if (listing.userId === user.id) {
    return { ok: false, message: "You can't review your own app." };
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
      ok: false,
      message:
        "You can write a review after the developer confirms you've joined testing.",
    };
  }

  const existing = await prisma.review.findUnique({
    where: {
      appListingId_testerUserId: {
        appListingId: listing.id,
        testerUserId: user.id,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, message: "You've already reviewed this app." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: {
          appListingId: listing.id,
          testerUserId: user.id,
          content,
        },
      });
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { reviewsWrittenCount: { increment: 1 } },
        select: { reviewsWrittenCount: true },
      });
      await awardBadgesAfterReviewWritten(tx, {
        userId: user.id,
        reviewsWrittenCount: updated.reviewsWrittenCount,
      });
    });
  } catch (err) {
    console.error("[reviews] createReview failed", err);
    return {
      ok: false,
      message: "Could not save your review. Try again in a moment.",
    };
  }

  revalidatePath(appPath(listing.id));
  revalidatePath(profilePath(user.profileSlug));
  invalidatePublicCaches({
    listingId: listing.id,
    profileSlugs: user.profileSlug,
  });

  return { ok: true, message: "Review published — thanks for the feedback." };
}
