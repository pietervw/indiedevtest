import type { BadgeType, Prisma, PrismaClient } from "@/generated/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * MVP thresholds (spec §9 leaves Super Tester TBD; Helpful Dev was
 * leaderboard-based). Fixed counts keep awards automatic and idempotent.
 */
export const SUPER_TESTER_THRESHOLD = 6;
/** Reviews written to earn Helpful Dev — MVP stand-in for leaderboard rank. */
export const HELPFUL_DEV_THRESHOLD = 6;

export type BadgeDefinition = {
  type: BadgeType;
  label: string;
  description: string;
};

export type EarnedBadge = {
  badgeType: BadgeType;
  earnedAt: Date;
};

export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  {
    type: "first_12",
    label: "First 12",
    description:
      "Completed a testing cycle — first tester marked complete on one of your apps.",
  },
  {
    type: "super_tester",
    label: "Super Tester",
    description: `Completed ${SUPER_TESTER_THRESHOLD}+ tests for other developers.`,
  },
  {
    type: "helpful_dev",
    label: "Helpful Dev",
    description: `Wrote ${HELPFUL_DEV_THRESHOLD}+ reviews (MVP threshold).`,
  },
] as const;

const DEFINITION_BY_TYPE = Object.fromEntries(
  BADGE_DEFINITIONS.map((d) => [d.type, d])
) as Record<BadgeType, BadgeDefinition>;

export function badgeDefinition(type: BadgeType): BadgeDefinition {
  return DEFINITION_BY_TYPE[type];
}

/**
 * Idempotent award via unique (userId, badgeType). Empty update preserves
 * the original earnedAt / metadata on retries and races.
 */
export async function awardBadge(
  db: Db,
  userId: string,
  badgeType: BadgeType,
  metadata?: Prisma.InputJsonValue
): Promise<void> {
  await db.userBadge.upsert({
    where: {
      userId_badgeType: { userId, badgeType },
    },
    create: {
      userId,
      badgeType,
      ...(metadata !== undefined ? { metadata } : {}),
    },
    update: {},
  });
}

export async function awardBadgesAfterTestCompleted(
  db: Db,
  options: {
    developerUserId: string;
    testerUserId: string;
    /** Tester's completed score after the increment. */
    testerCompletedCount: number;
    assignmentId: string;
  }
): Promise<void> {
  // Always upsert: concurrent first completions can't miss the badge
  // (count-based "is this first?" races under-award).
  await awardBadge(db, options.developerUserId, "first_12", {
    sourceAssignmentId: options.assignmentId,
  });

  if (options.testerCompletedCount >= SUPER_TESTER_THRESHOLD) {
    await awardBadge(db, options.testerUserId, "super_tester", {
      threshold: SUPER_TESTER_THRESHOLD,
    });
  }
}

export async function awardBadgesAfterReviewWritten(
  db: Db,
  options: {
    userId: string;
    reviewsWrittenCount: number;
  }
): Promise<void> {
  if (options.reviewsWrittenCount >= HELPFUL_DEV_THRESHOLD) {
    await awardBadge(db, options.userId, "helpful_dev", {
      threshold: HELPFUL_DEV_THRESHOLD,
    });
  }
}

const THRESHOLD_BY_BADGE = {
  super_tester: SUPER_TESTER_THRESHOLD,
  helpful_dev: HELPFUL_DEV_THRESHOLD,
} as const;

/**
 * Drop a count-based badge when the backing score falls below its bar
 * (incomplete reversal, listing delete). deleteMany is a no-op if absent.
 */
export async function revokeBadgeBelowThreshold(
  db: Db,
  userId: string,
  badgeType: keyof typeof THRESHOLD_BY_BADGE,
  count: number
): Promise<void> {
  if (count < THRESHOLD_BY_BADGE[badgeType]) {
    await db.userBadge.deleteMany({ where: { userId, badgeType } });
  }
}

/**
 * First 12 is a milestone for having any completed tester on your apps.
 * Revoke when none remain (incomplete reversal or listing delete).
 */
export async function syncFirst12Badge(
  db: Db,
  developerUserId: string
): Promise<void> {
  const remaining = await db.testAssignment.count({
    where: {
      status: "completed",
      appListing: { userId: developerUserId },
    },
  });
  if (remaining === 0) {
    await db.userBadge.deleteMany({
      where: { userId: developerUserId, badgeType: "first_12" },
    });
  }
}
