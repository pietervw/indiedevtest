import { invalidateBrowseAppsCache } from "@/lib/browse-apps";
import { invalidateDevProfileCache } from "@/lib/dev-profile";
import { invalidateHomeTopAppsCache } from "@/lib/home-top-apps";
import { invalidateLeaderboardsCache } from "@/lib/leaderboards";
import { invalidatePublicListingCache } from "@/lib/public-listing";

/** Clear public page memory caches after listing / assignment mutations. */
export function invalidatePublicCaches(options?: {
  listingId?: string;
  /** Profile cache keys to drop. Omitted = leave profile caches alone. */
  githubUsernames?: string | string[];
}) {
  invalidateHomeTopAppsCache();
  invalidateBrowseAppsCache();
  invalidateLeaderboardsCache();
  invalidatePublicListingCache(options?.listingId);

  const names = options?.githubUsernames;
  if (names == null) return;
  for (const username of Array.isArray(names) ? names : [names]) {
    invalidateDevProfileCache(username);
  }
}
