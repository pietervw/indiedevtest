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
 * Best-effort reclaim of unspent points (e.g. incomplete evidence or deleted
 * reviews). Caps at the current balance so spent awards are not driven negative.
 * Does not clear pointAwardedAt — points are fungible and clearing would allow
 * a remint after a spent award when another review's credit remains.
 */
export async function reclaimUnspentReviewPoints(
  db: Db,
  options: { userId: string; count: number }
): Promise<void> {
  for (let i = 0; i < options.count; i++) {
    const { count } = await db.user.updateMany({
      where: { id: options.userId, reviewPoints: { gt: 0 } },
      data: { reviewPoints: { decrement: 1 } },
    });
    if (count !== 1) {
      break;
    }
  }
}

/** Reclaim one unspent point if this review previously minted. */
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
  await reclaimUnspentReviewPoints(db, { userId: options.userId, count: 1 });
}
