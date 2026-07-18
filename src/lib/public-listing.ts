import type { AppCategory, AppListingStatus, Platform } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { COUNTED_ASSIGNMENT_STATUSES } from "@/lib/listing-status";

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

export function invalidatePublicListingCache(listingId?: string) {
  if (listingId) {
    memoryCache.delete(listingId);
    return;
  }
  memoryCache.clear();
}

function toPublicListing(
  row: NonNullable<Awaited<ReturnType<typeof fetchListing>>>
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

async function fetchListing(id: string) {
  return prisma.appListing.findUnique({
    where: { id },
    include: {
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
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: {
        select: {
          testAssignments: {
            where: { status: { in: [...COUNTED_ASSIGNMENT_STATUSES] } },
          },
        },
      },
    },
  });
}

/** Cached listing for /apps/[id] page + generateMetadata. */
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
    const row = await fetchListing(id);
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
