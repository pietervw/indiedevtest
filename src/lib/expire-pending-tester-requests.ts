import "server-only";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

/** Spec: pending tester requests auto-expire after 60 days. */
export const TESTER_REQUEST_TTL_MS = 60 * 24 * 60 * 60 * 1000;

export type ExpirePendingTesterRequestsScope = {
  /** Limit to one listing (session / listing mutations). */
  listingId?: string;
  /** Pending requests created by this tester. */
  testerUserId?: string;
  /** Pending requests on listings owned by this user. */
  ownerUserId?: string;
};

/**
 * Atomically mark overdue pending TesterRequests as `expired`.
 *
 * Prefer a listing/user scope when available so generic reads do not scan the
 * whole table. When both `testerUserId` and `ownerUserId` are set (dashboard),
 * they are combined with OR so a user's own requests and their owned listings'
 * queues are covered in one pass.
 *
 * Clears public in-memory caches only when at least one row actually changed.
 * Cache invalidation is dynamically imported to avoid a cycle with browse-apps.
 */
export async function expirePendingTesterRequests(
  scope?: ExpirePendingTesterRequestsScope
): Promise<number> {
  if (!process.env.DATABASE_URL) {
    return 0;
  }

  const where = buildExpireWhere(scope);

  const { count } = await prisma.testerRequest.updateMany({
    where,
    data: { status: "expired" },
  });

  if (count > 0) {
    const { invalidatePublicCaches } = await import(
      "@/lib/invalidate-public-caches"
    );
    invalidatePublicCaches(
      scope?.listingId ? { listingId: scope.listingId } : undefined
    );
  }

  return count;
}

/** Pending and not yet past `expiresAt` (defense-in-depth alongside lazy expiry). */
export function pendingNotExpiredWhere(
  now = new Date()
): Prisma.TesterRequestWhereInput {
  return { status: "pending", expiresAt: { gt: now } };
}

/** Owner/tester "open" queue: live pending or accepted but not yet joined. */
export function openTesterRequestWhere(
  now = new Date()
): Prisma.TesterRequestWhereInput {
  return {
    OR: [
      pendingNotExpiredWhere(now),
      { status: "accepted", testAssignmentId: null },
    ],
  };
}

function buildExpireWhere(
  scope?: ExpirePendingTesterRequestsScope
): Prisma.TesterRequestWhereInput {
  const where: Prisma.TesterRequestWhereInput = {
    status: "pending",
    expiresAt: { lte: new Date() },
  };

  if (scope?.listingId) {
    where.appListingId = scope.listingId;
  }

  const testerUserId = scope?.testerUserId;
  const ownerUserId = scope?.ownerUserId;

  if (testerUserId && ownerUserId) {
    where.OR = [
      { testerUserId },
      { appListing: { userId: ownerUserId } },
    ];
  } else if (testerUserId) {
    where.testerUserId = testerUserId;
  } else if (ownerUserId) {
    where.appListing = { userId: ownerUserId };
  }

  return where;
}
