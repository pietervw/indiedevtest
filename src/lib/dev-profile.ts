import type { EarnedBadge } from "@/lib/badges";
import { prisma } from "@/lib/db";
import {
  COUNTED_ASSIGNMENT_STATUSES,
  PUBLIC_LISTING_STATUSES,
} from "@/lib/listing-status";
import { mapListingToApp, type App } from "@/lib/mock-data";

/** Dev profiles — 30 min memory cache per username. */
export const DEV_PROFILE_TTL_MS = 30 * 60 * 1000;
/** Upper bound on cached profiles — guards against unbounded growth from
 *  distinct usernames (e.g. a crawler hitting many /dev/<x> URLs). */
const DEV_PROFILE_CACHE_MAX = 1000;

export type DevProfile = {
  id: string;
  displayName: string;
  githubUsername: string;
  imageUrl: string | null;
  bio: string | null;
  twitterHandle: string | null;
  profileScoreJoined: number;
  profileScoreCompleted: number;
  reviewsWrittenCount: number;
  badges: EarnedBadge[];
  apps: App[];
};

type CacheEntry = {
  expiresAt: number;
  profile: DevProfile | null;
};

const memoryCache = new Map<string, CacheEntry>();

export function invalidateDevProfileCache(githubUsername?: string) {
  if (githubUsername) {
    // Match the case the DB is queried with (see getDevProfile) — the unique
    // lookup is case-sensitive, so the cache key must be too, otherwise
    // /dev/JOHN and /dev/john would share an entry and poison each other.
    memoryCache.delete(githubUsername);
    return;
  }
  memoryCache.clear();
}

/** Cached public developer profile for /dev/[username]. */
export async function getDevProfile(
  githubUsername: string
): Promise<DevProfile | null> {
  const now = Date.now();
  const hit = memoryCache.get(githubUsername);
  if (hit && hit.expiresAt > now) {
    return hit.profile;
  }

  if (!process.env.DATABASE_URL) {
    return hit?.profile ?? null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { githubUsername },
      include: {
        badges: {
          select: { badgeType: true, earnedAt: true },
          orderBy: { earnedAt: "asc" },
        },
        appListings: {
          where: {
            status: { in: [...PUBLIC_LISTING_STATUSES] },
          },
          include: {
            _count: {
              select: {
                testAssignments: {
                  where: { status: { in: [...COUNTED_ASSIGNMENT_STATUSES] } },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const profile: DevProfile | null = user
      ? {
          id: user.id,
          displayName: user.displayName,
          githubUsername: user.githubUsername,
          imageUrl: user.imageUrl,
          bio: user.bio,
          twitterHandle: user.twitterHandle,
          profileScoreJoined: user.profileScoreJoined,
          profileScoreCompleted: user.profileScoreCompleted,
          reviewsWrittenCount: user.reviewsWrittenCount,
          badges: user.badges,
          apps: user.appListings.map((listing) =>
            mapListingToApp({
              id: listing.id,
              name: listing.name,
              logoUrl: listing.logoUrl,
              category: listing.category,
              platform: listing.platform,
              testers: listing._count.testAssignments,
            })
          ),
        }
      : null;

    if (memoryCache.size >= DEV_PROFILE_CACHE_MAX) {
      memoryCache.clear();
    }
    memoryCache.set(githubUsername, {
      expiresAt: now + DEV_PROFILE_TTL_MS,
      profile,
    });
    return profile;
  } catch (err) {
    console.error("[dev-profile] query failed", err);
    return hit?.profile ?? null;
  }
}
