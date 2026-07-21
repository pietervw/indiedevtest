import type { EarnedBadge } from "@/lib/badges";
import { prisma } from "@/lib/db";
import {
  COUNTED_ASSIGNMENT_STATUSES,
  PUBLIC_LISTING_STATUSES,
} from "@/lib/listing-status";
import { mapListingToApp, type App } from "@/lib/mock-data";

/** Dev profiles — 30 min memory cache per public slug. */
export const DEV_PROFILE_TTL_MS = 30 * 60 * 1000;
/** Upper bound on cached profiles — guards against unbounded growth from
 *  distinct usernames (e.g. a crawler hitting many /dev/<x> URLs). */
const DEV_PROFILE_CACHE_MAX = 1000;

export type DevProfile = {
  id: string;
  displayName: string;
  githubId: string | null;
  profileSlug: string;
  githubLogin: string | null;
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

export function invalidateDevProfileCache(profileSlug?: string) {
  if (profileSlug) {
    // Match the case the DB is queried with (see getDevProfile) — the unique
    // lookup is case-sensitive, so the cache key must be too, otherwise
    // /dev/JOHN and /dev/john would share an entry and poison each other.
    memoryCache.delete(profileSlug);
    return;
  }
  memoryCache.clear();
}

/** Cached public developer profile for /dev/[profileSlug]. */
export async function getDevProfile(
  profileSlug: string
): Promise<DevProfile | null> {
  const now = Date.now();
  const hit = memoryCache.get(profileSlug);
  if (hit && hit.expiresAt > now) {
    return hit.profile;
  }

  if (!process.env.DATABASE_URL) {
    return hit?.profile ?? null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { profileSlug },
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
          githubId: user.githubId,
          profileSlug: user.profileSlug,
          githubLogin: user.githubLogin,
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
    memoryCache.set(profileSlug, {
      expiresAt: now + DEV_PROFILE_TTL_MS,
      profile,
    });
    return profile;
  } catch (err) {
    console.error("[dev-profile] query failed", err);
    return hit?.profile ?? null;
  }
}

/** Resolves a pre-slug GitHub profile URL so old shared links keep working. */
export async function getProfileSlugForLegacyGithubUsername(
  githubUsername: string
): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { githubUsername },
      select: { profileSlug: true },
    });
    return user?.profileSlug ?? null;
  } catch (err) {
    console.error("[dev-profile] legacy URL lookup failed", err);
    return null;
  }
}
