import { invalidateBrowseAppsCache } from "@/lib/browse-apps";
import { invalidateDevProfileCache } from "@/lib/dev-profile";
import { invalidateHomeTopAppsCache } from "@/lib/home-top-apps";
import { invalidatePublicListingCache } from "@/lib/public-listing";

/** Clear public page memory caches after listing / assignment mutations. */
export function invalidatePublicCaches(options?: {
  listingId?: string;
  githubUsername?: string;
}) {
  invalidateHomeTopAppsCache();
  invalidateBrowseAppsCache();
  invalidatePublicListingCache(options?.listingId);
  invalidateDevProfileCache(options?.githubUsername);
}
