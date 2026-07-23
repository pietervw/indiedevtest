import {
  TesterRequestStatus,
  type AppCategory,
  type AppListingStatus,
  type Platform,
} from "@/generated/prisma";
import { prisma } from "@/lib/db";
import {
  COUNTED_ASSIGNMENT_STATUSES,
  PUBLIC_LISTING_STATUSES,
} from "@/lib/listing-status";
import { EVIDENCE_IMAGE_LIMITS } from "@/lib/storage/image-limits";
import {
  isCompleteEvidence,
  MIN_IMPROVEMENT_LENGTH,
} from "@/lib/test-evidence";

/** Public listing payload — 10 min memory cache per id. */
export const PUBLIC_LISTING_TTL_MS = 10 * 60 * 1000;
/** Upper bound on cached listings — guards against unbounded growth from
 *  distinct ids (e.g. a crawler hitting many /apps/<id> URLs). */
const PUBLIC_LISTING_CACHE_MAX = 1000;
/** Max complete feedback rows shown on a public listing. */
const PUBLIC_FEEDBACK_LIMIT = 50;

export type PublicListingFeedbackScreenshot = {
  id: string;
  publicUrl: string;
  sortOrder: number;
  width: number;
  height: number;
};

export type PublicListingFeedback = {
  id: string;
  improvementSuggestion: string;
  createdAt: string;
  updatedAt: string;
  tester: {
    id: string;
    displayName: string;
    imageUrl: string | null;
    profileSlug: string;
  };
  screenshots: PublicListingFeedbackScreenshot[];
};

export type PublicListingScreenshot = {
  id: string;
  publicUrl: string;
  sortOrder: number;
  width: number;
  height: number;
};

export type PublicListing = {
  id: string;
  userId: string;
  name: string;
  logoUrl: string;
  description: string;
  category: AppCategory;
  platform: Platform;
  status: AppListingStatus;
  storeLink: string | null;
  showTesterFeedback: boolean;
  testers: number;
  testerCapacity: number | null;
  acceptedTesters: number;
  updatedAt: string;
  user: {
    id: string;
    displayName: string;
    imageUrl: string | null;
    profileSlug: string;
  };
  /** Complete evidence rows (may still be hidden publicly via showTesterFeedback). */
  feedback: PublicListingFeedback[];
  screenshots: PublicListingScreenshot[];
};

type CacheEntry = {
  expiresAt: number;
  listing: PublicListing | null;
};

const memoryCache = new Map<string, CacheEntry>();

const listingInclude = {
  user: {
    select: {
      id: true,
      displayName: true,
      imageUrl: true,
      profileSlug: true,
    },
  },
  screenshots: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      publicUrl: true,
      sortOrder: true,
      width: true,
      height: true,
    },
  },
  _count: {
    select: {
      testAssignments: {
        where: { status: { in: [...COUNTED_ASSIGNMENT_STATUSES] } },
      },
      testerRequests: {
        where: { status: TesterRequestStatus.accepted },
      },
    },
  },
};

const completeFeedbackInclude = {
  tester: {
    select: {
      id: true,
      displayName: true,
      imageUrl: true,
      profileSlug: true,
    },
  },
  screenshots: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      publicUrl: true,
      sortOrder: true,
      width: true,
      height: true,
    },
  },
} as const;

/** Complete evidence only — apply the display cap after completeness, not before. */
async function fetchCompleteFeedback(listingId: string) {
  const completeIds = await prisma.$queryRaw<{ id: string }[]>`
    SELECT r.id
    FROM reviews r
    WHERE r.app_listing_id = ${listingId}
      AND length(
        regexp_replace(r.improvement_suggestion, E'^\\s+|\\s+$', '', 'g')
      ) >= ${MIN_IMPROVEMENT_LENGTH}
      AND (
        SELECT COUNT(*)::int
        FROM review_screenshots s
        WHERE s.review_id = r.id
      ) >= ${EVIDENCE_IMAGE_LIMITS.minFiles}
    ORDER BY r.created_at DESC
    LIMIT ${PUBLIC_FEEDBACK_LIMIT}
  `;

  if (completeIds.length === 0) {
    return [];
  }

  const reviews = await prisma.review.findMany({
    where: { id: { in: completeIds.map((row) => row.id) } },
    include: completeFeedbackInclude,
  });

  const order = new Map(completeIds.map((row, index) => [row.id, index]));
  return reviews.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  );
}

export function invalidatePublicListingCache(listingId?: string) {
  if (listingId) {
    memoryCache.delete(listingId);
    return;
  }
  memoryCache.clear();
}

function toPublicListing(
  row: NonNullable<Awaited<ReturnType<typeof fetchPublicListingRow>>>
): PublicListing {
  const feedback = row.reviews
    .map((review) => {
      // SQL already constrained to complete rows; keep the helper as a guard.
      if (
        !isCompleteEvidence({
          improvementSuggestion: review.improvementSuggestion,
          screenshotCount: review.screenshots.length,
        })
      ) {
        return null;
      }
      return {
        id: review.id,
        improvementSuggestion: review.improvementSuggestion,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        tester: review.tester,
        screenshots: review.screenshots,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    logoUrl: row.logoUrl.trim(),
    description: row.description,
    category: row.category,
    platform: row.platform,
    status: row.status,
    storeLink: row.storeLink,
    showTesterFeedback: row.showTesterFeedback,
    testers: row._count.testAssignments,
    testerCapacity: row.testerCapacity,
    acceptedTesters: row._count.testerRequests,
    updatedAt: row.updatedAt.toISOString(),
    user: row.user,
    feedback,
    screenshots: row.screenshots.map((shot) => ({
      id: shot.id,
      publicUrl: shot.publicUrl,
      sortOrder: shot.sortOrder,
      width: shot.width,
      height: shot.height,
    })),
  };
}

/** Public statuses only — never returns or caches drafts. */
async function fetchPublicListingRow(id: string) {
  const listing = await prisma.appListing.findFirst({
    where: {
      id,
      status: { in: [...PUBLIC_LISTING_STATUSES] },
      moderationStatus: "visible",
    },
    include: listingInclude,
  });
  if (!listing) {
    return null;
  }
  const reviews = await fetchCompleteFeedback(id);
  return { ...listing, reviews };
}

/** Owner draft/non-public preview — uncached, scoped to ownerId. */
async function fetchOwnerListingRow(id: string, ownerId: string) {
  const listing = await prisma.appListing.findFirst({
    where: { id, userId: ownerId },
    include: listingInclude,
  });
  if (!listing) {
    return null;
  }
  const reviews = await fetchCompleteFeedback(id);
  return { ...listing, reviews };
}

/** Cached public listing for /apps/[id] metadata + anonymous/public views. */
export async function getPublicListing(
  id: string
): Promise<PublicListing | null> {
  const now = Date.now();
  const hit = memoryCache.get(id);
  if (hit && hit.expiresAt > now) {
    return hit.listing;
  }

  if (!process.env.DATABASE_URL) {
    return hit?.listing ?? null;
  }

  try {
    const row = await fetchPublicListingRow(id);
    const listing = row ? toPublicListing(row) : null;
    if (memoryCache.size >= PUBLIC_LISTING_CACHE_MAX) {
      memoryCache.clear();
    }
    memoryCache.set(id, { expiresAt: now + PUBLIC_LISTING_TTL_MS, listing });
    return listing;
  } catch (err) {
    console.error("[public-listing] query failed", err);
    return hit?.listing ?? null;
  }
}

/** Uncached owner-only listing (drafts and other non-public statuses). */
export async function getOwnerListing(
  id: string,
  ownerId: string
): Promise<PublicListing | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const row = await fetchOwnerListingRow(id, ownerId);
    return row ? toPublicListing(row) : null;
  } catch (err) {
    console.error("[public-listing] owner query failed", err);
    return null;
  }
}
