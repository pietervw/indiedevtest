"use server";

import { isClerkAPIResponseError } from "@clerk/backend/errors";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth-guards";
import { revokeBadgeBelowThreshold, syncFirst12Badge } from "@/lib/badges";
import { prisma } from "@/lib/db";
import { invalidatePublicCaches } from "@/lib/invalidate-public-caches";
import { appPath, profilePath } from "@/lib/mock-data";
import { field } from "@/lib/validation";

export type DeleteAccountState = { ok: boolean; message: string };

function isClerkUserAlreadyDeleted(error: unknown): boolean {
  return (
    isClerkAPIResponseError(error) &&
    (error.status === 404 ||
      error.errors.some((e) => e.code === "resource_not_found"))
  );
}

/** Permanently removes the account and all locally owned data. Database cascades
 * take listings and the public developer profile offline in the same deletion. */
export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  if (field(formData, "confirmation") !== "DELETE") {
    return { ok: false, message: 'Type DELETE to confirm permanent account deletion.' };
  }

  const user = await requireDbUser();

  // Delete Clerk first so a failed remote delete leaves the local row intact.
  // Otherwise ensureDbUser would recreate a profile on the next sign-in.
  // Treat "already deleted" as success so a retry can finish local cleanup if
  // Clerk succeeded earlier but the database delete failed.
  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(user.clerkId);
  } catch (error) {
    if (!isClerkUserAlreadyDeleted(error)) {
      console.error("[account] Clerk account deletion failed", error);
      return {
        ok: false,
        message: "Could not delete your sign-in account. Please try again or contact support.",
      };
    }
  }

  const testerSelect = {
    testerUserId: true,
    tester: { select: { profileSlug: true } },
  } as const;

  try {
    const { listingIds, affectedProfileSlugs } = await prisma.$transaction(
      async (tx) => {
        // Lock the user and related score-bearing rows so concurrent
        // completes/reviews can't be cascade-deleted without a matching decrement.
        await tx.$executeRaw`SELECT 1 FROM users WHERE id = ${user.id} FOR UPDATE`;
        await tx.$executeRaw`
          SELECT id FROM test_assignments
          WHERE tester_user_id = ${user.id}
             OR app_listing_id IN (SELECT id FROM app_listings WHERE user_id = ${user.id})
          FOR UPDATE`;
        await tx.$executeRaw`
          SELECT id FROM reviews
          WHERE tester_user_id = ${user.id}
             OR app_listing_id IN (SELECT id FROM app_listings WHERE user_id = ${user.id})
          FOR UPDATE`;

        const listingIds = await tx.appListing.findMany({
          where: { userId: user.id },
          select: { id: true },
        });
        const ownedListingIds = listingIds.map((listing) => listing.id);

        const [ownedCompleted, ownedReviews, testerCompleted] = await Promise.all([
          ownedListingIds.length > 0
            ? tx.testAssignment.findMany({
                where: {
                  appListingId: { in: ownedListingIds },
                  status: "completed",
                  testerUserId: { not: user.id },
                },
                select: testerSelect,
              })
            : Promise.resolve([]),
          ownedListingIds.length > 0
            ? tx.review.findMany({
                where: {
                  appListingId: { in: ownedListingIds },
                  testerUserId: { not: user.id },
                },
                select: testerSelect,
              })
            : Promise.resolve([]),
          tx.testAssignment.findMany({
            where: {
              testerUserId: user.id,
              status: "completed",
              appListing: { userId: { not: user.id } },
            },
            select: {
              appListing: {
                select: {
                  userId: true,
                  user: { select: { profileSlug: true } },
                },
              },
            },
          }),
        ]);

        const completedByUser = new Map<string, number>();
        for (const assignment of ownedCompleted) {
          completedByUser.set(
            assignment.testerUserId,
            (completedByUser.get(assignment.testerUserId) ?? 0) + 1
          );
        }
        const reviewsByUser = new Map<string, number>();
        for (const review of ownedReviews) {
          reviewsByUser.set(
            review.testerUserId,
            (reviewsByUser.get(review.testerUserId) ?? 0) + 1
          );
        }

        const affectedTesterIds = new Set([
          ...completedByUser.keys(),
          ...reviewsByUser.keys(),
        ]);
        for (const testerId of affectedTesterIds) {
          const completedDec = completedByUser.get(testerId) ?? 0;
          const reviewDec = reviewsByUser.get(testerId) ?? 0;
          const updated = await tx.user.update({
            where: { id: testerId },
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
              testerId,
              "super_tester",
              updated.profileScoreCompleted
            );
          }
          if (reviewDec > 0) {
            await revokeBadgeBelowThreshold(
              tx,
              testerId,
              "helpful_dev",
              updated.reviewsWrittenCount
            );
          }
        }

        const developersToSync = [
          ...new Set(testerCompleted.map((row) => row.appListing.userId)),
        ];

        await tx.user.delete({ where: { id: user.id } });

        for (const developerId of developersToSync) {
          await syncFirst12Badge(tx, developerId);
        }

        return {
          listingIds,
          affectedProfileSlugs: [
            ...new Set([
              ...ownedCompleted.map((row) => row.tester.profileSlug),
              ...ownedReviews.map((row) => row.tester.profileSlug),
              ...testerCompleted.map((row) => row.appListing.user.profileSlug),
            ]),
          ],
        };
      }
    );

    invalidatePublicCaches({
      profileSlugs: [user.profileSlug, ...affectedProfileSlugs],
    });
    revalidatePath("/");
    revalidatePath("/browse");
    revalidatePath("/dashboard");
    revalidatePath(profilePath(user.profileSlug));
    for (const slug of affectedProfileSlugs) revalidatePath(profilePath(slug));
    for (const listing of listingIds) revalidatePath(appPath(listing.id));
  } catch (error) {
    console.error("[account] local account deletion failed after Clerk delete", error);
    return {
      ok: false,
      message: "Your sign-in was removed, but local data could not be deleted. Please try again or contact support.",
    };
  }

  return { ok: true, message: "Your account, public profile, and listings have been permanently deleted." };
}
