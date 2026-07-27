import type { Prisma, PrismaClient } from "@/generated/prisma";
import { awardBadgesAfterReviewWritten } from "@/lib/badges";

type Db = PrismaClient | Prisma.TransactionClient;

/** Credit reviewsWrittenCount (+ one point if this review has never minted). */
export async function creditReviewOnEvidenceComplete(
  db: Db,
  options: {
    userId: string;
    reviewId: string;
    pointAwardedAt: Date | null;
  }
): Promise<{ reviewsWrittenCount: number; pointEarned: boolean }> {
  const pointEarned = options.pointAwardedAt === null;
  const updated = await db.user.update({
    where: { id: options.userId },
    data: {
      reviewsWrittenCount: { increment: 1 },
      ...(pointEarned ? { reviewPoints: { increment: 1 } } : {}),
    },
    select: { reviewsWrittenCount: true },
  });
  if (pointEarned) {
    await db.review.update({
      where: { id: options.reviewId },
      data: { pointAwardedAt: new Date() },
    });
  }
  await awardBadgesAfterReviewWritten(db, {
    userId: options.userId,
    reviewsWrittenCount: updated.reviewsWrittenCount,
  });
  return {
    reviewsWrittenCount: updated.reviewsWrittenCount,
    pointEarned,
  };
}

/**
 * Best-effort reclaim when evidence becomes incomplete.
 * Keep pointAwardedAt so this review never remints (points are fungible;
 * clearing the stamp when another review's credit remains would allow a
 * second mint after a spent award).
 */
export async function reclaimUnspentReviewPoint(
  db: Db,
  options: {
    userId: string;
    pointAwardedAt: Date | null;
  }
): Promise<void> {
  if (options.pointAwardedAt === null) {
    return;
  }
  await db.user.updateMany({
    where: { id: options.userId, reviewPoints: { gt: 0 } },
    data: { reviewPoints: { decrement: 1 } },
  });
}
