import "server-only";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { sendListing14DayReminderEmail } from "@/lib/email";
import { COUNTED_ASSIGNMENT_STATUSES } from "@/lib/listing-status";
import { TESTER_SLOT_MAX, TESTING_PERIOD_MS, appPath } from "@/lib/mock-data";
import { siteConfig } from "@/lib/site";

/** Spec: remind once the Nth counted tester (slot max) has been in for the testing period. */
const REMINDER_TESTER_OFFSET = TESTER_SLOT_MAX - 1;

export type ListingReminderRunSummary = {
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
};

type ReminderCandidate = {
  id: string;
  name: string;
  clerkId: string;
  displayName: string;
  fourteenthJoinedAt: Date;
};

type RawQueryable = Pick<typeof prisma, "$queryRaw">;

const countedStatusSql = Prisma.join(
  COUNTED_ASSIGNMENT_STATUSES.map(
    (status) => Prisma.sql`${status}::"TestAssignmentStatus"`
  )
);

/**
 * Shared candidate SELECT for find + claim. Claim passes listingId + FOR UPDATE
 * so eligibility filters cannot drift between the two paths.
 */
async function queryReminderCandidates(
  db: RawQueryable,
  options: {
    threshold: Date;
    listingId?: string;
    forUpdate?: boolean;
  }
): Promise<ReminderCandidate[]> {
  const listingFilter = options.listingId
    ? Prisma.sql`AND al.id = ${options.listingId}`
    : Prisma.empty;
  const lockClause = options.forUpdate
    ? Prisma.sql`FOR UPDATE OF al`
    : Prisma.empty;

  return db.$queryRaw<ReminderCandidate[]>`
    SELECT
      al.id,
      al.name,
      u.clerk_id AS "clerkId",
      u.display_name AS "displayName",
      fourteenth.joined_at AS "fourteenthJoinedAt"
    FROM app_listings al
    INNER JOIN users u ON u.id = al.user_id
    INNER JOIN LATERAL (
      SELECT ta.joined_at
      FROM test_assignments ta
      WHERE ta.app_listing_id = al.id
        AND ta.status IN (${countedStatusSql})
      ORDER BY ta.joined_at ASC, ta.id ASC
      OFFSET ${REMINDER_TESTER_OFFSET}
      LIMIT 1
    ) fourteenth ON TRUE
    WHERE al.reminder_sent_at IS NULL
      AND al.status <> 'launched'::"AppListingStatus"
      AND fourteenth.joined_at <= ${options.threshold}
      ${listingFilter}
    ${lockClause}
  `;
}

async function findReminderCandidates(
  now = new Date()
): Promise<ReminderCandidate[]> {
  return queryReminderCandidates(prisma, {
    threshold: new Date(now.getTime() - TESTING_PERIOD_MS),
  });
}

/**
 * Transactional CAS under row lock: re-check eligibility, set reminderSentAt
 * only if still null. Cleared again if the email fails.
 */
async function claimReminderSlot(
  listingId: string,
  claimedAt: Date
): Promise<ReminderCandidate | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await queryReminderCandidates(tx, {
      threshold: new Date(claimedAt.getTime() - TESTING_PERIOD_MS),
      listingId,
      forUpdate: true,
    });

    const row = rows[0];
    if (!row) {
      return null;
    }

    const { count } = await tx.appListing.updateMany({
      where: { id: listingId, reminderSentAt: null },
      data: { reminderSentAt: claimedAt },
    });

    return count === 1 ? row : null;
  });
}

async function releaseReminderClaim(
  listingId: string,
  claimedAt: Date
): Promise<void> {
  await prisma.appListing.updateMany({
    where: { id: listingId, reminderSentAt: claimedAt },
    data: { reminderSentAt: null },
  });
}

async function processCandidate(
  candidate: ReminderCandidate
): Promise<"sent" | "skipped" | "failed"> {
  const claimedAt = new Date();
  const claimed = await claimReminderSlot(candidate.id, claimedAt);
  if (!claimed) {
    return "skipped";
  }

  try {
    await sendListing14DayReminderEmail({
      devClerkId: claimed.clerkId,
      devName: claimed.displayName,
      appName: claimed.name,
      listingUrl: `${siteConfig.url}${appPath(claimed.id)}`,
      fourteenthJoinedAt: claimed.fourteenthJoinedAt,
    });
    return "sent";
  } catch (err) {
    console.error("[listing-14-day-reminders] send failed", {
      listingId: claimed.id,
      err,
    });
    try {
      await releaseReminderClaim(claimed.id, claimedAt);
    } catch (releaseErr) {
      console.error("[listing-14-day-reminders] failed to release claim", {
        listingId: claimed.id,
        releaseErr,
      });
    }
    return "failed";
  }
}

/** Find due 14-day reminders and email owners once each (cron-safe CAS). */
export async function runListing14DayReminders(
  now = new Date()
): Promise<ListingReminderRunSummary> {
  const summary: ListingReminderRunSummary = {
    checked: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  if (!process.env.DATABASE_URL) {
    return summary;
  }

  const candidates = await findReminderCandidates(now);
  summary.checked = candidates.length;

  for (const candidate of candidates) {
    const result = await processCandidate(candidate);
    summary[result] += 1;
  }

  return summary;
}
