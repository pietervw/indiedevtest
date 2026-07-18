import type { AppCategory, AppListingStatus, Platform } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import {
  COUNTED_ASSIGNMENT_STATUSES,
  PUBLIC_LISTING_STATUSES,
} from "@/lib/listing-status";

/** Public listing payload — 10 min memory cache per id. */
export const PUBLIC_LISTING_TTL_MS = 10 * 60 * 1000;
/** Upper bound on cached listings — guards against unbounded growth from
 *  distinct ids (e.g. a crawler hitting many /apps/<id> URLs). */
const PUBLIC_LISTING_CACHE_MAX = 1000;

export type PublicListingReview = {
  id: string;
  content: string;
  createdAt: string;
  tester: {
    displayName: string;
    imageUrl: string | null;
    githubUsername: string;
  };
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
  testers: number;
  updatedAt: string;
  user: {
    id: string;
    displayName: string;
    imageUrl: string | null;
    githubUsername: string;
  };
  reviews: PublicListingReview[];
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
      githubUsername: true,
    },
  },
  reviews: {
    include: {
      tester: {
        select: {
          displayName: true,
          imageUrl: true,
          githubUsername: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
    take: 50,
  },
  _count: {
    select: {
      testAssignments: {
        where: { status: { in: [...COUNTED_ASSIGNMENT_STATUSES] } },
      },
    },
  },
};

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
    testers: row._count.testAssignments,
    updatedAt: row.updatedAt.toISOString(),
    user: row.user,
    reviews: row.reviews.map((review) => ({
      id: review.id,
      content: review.content,
      createdAt: review.createdAt.toISOString(),
      tester: review.tester,
    })),
  };
}

/** Public statuses only — never returns or caches drafts. */
async function fetchPublicListingRow(id: string) {
  return prisma.appListing.findFirst({
    where: {
      id,
      status: { in: [...PUBLIC_LISTING_STATUSES] },
    },
    include: listingInclude,
  });
}

/** Owner draft/non-public preview — uncached, scoped to ownerId. */
async function fetchOwnerListingRow(id: string, ownerId: string) {
  return prisma.appListing.findFirst({
    where: { id, userId: ownerId },
    include: listingInclude,
  });
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
