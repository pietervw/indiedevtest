import { prisma } from "@/lib/db";
import { expirePendingTesterRequests } from "@/lib/expire-pending-tester-requests";
import {
  categoryLabel,
  mapListingToApp,
  platformLabel,
  profilePath,
  type App,
} from "@/lib/mock-data";

/** Browse board — fresher than home (15 min). */
export const BROWSE_APPS_TTL_MS = 15 * 60 * 1000;

export type BrowseCategory = keyof typeof categoryLabel;
export type BrowsePlatform = keyof typeof platformLabel;
export type BrowseSort = "newest" | "requested" | "needed";

export type BrowseFilters = {
  category?: BrowseCategory;
  platform?: BrowsePlatform;
  sort: BrowseSort;
};

type BrowseRow = {
  id: string;
  name: string;
  logoUrl: string;
  category: string;
  platform: string;
  createdAt: Date;
  displayName: string;
  imageUrl: string | null;
  githubUsername: string;
  testers: number;
  requests: number;
};

type CachedApp = App & {
  categoryKey: string;
  platformKey: string;
  createdAt: number;
  requests: number;
};

type CacheEntry = {
  expiresAt: number;
  apps: CachedApp[];
};

let memoryCache: CacheEntry | null = null;

export function invalidateBrowseAppsCache() {
  memoryCache = null;
}

function param(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseBrowseFilters(
  params: Record<string, string | string[] | undefined>
): BrowseFilters {
  const category = param(params, "category");
  const platform = param(params, "platform");
  const sort = param(params, "sort");

  return {
    category:
      category && category in categoryLabel
        ? (category as BrowseCategory)
        : undefined,
    platform:
      platform && platform in platformLabel
        ? (platform as BrowsePlatform)
        : undefined,
    sort:
      sort === "requested" || sort === "needed" ? sort : "newest",
  };
}

async function loadBrowseApps(): Promise<CachedApp[]> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.apps;
  }

  if (!process.env.DATABASE_URL) {
    return memoryCache?.apps ?? [];
  }

  try {
    // Board-wide cache miss: no listing/user scope — expire globally once,
    // then recount. expires_at filter below is defense in depth.
    await expirePendingTesterRequests();

    const rows = await prisma.$queryRaw<BrowseRow[]>`
      SELECT
        al.id,
        al.name,
        al.logo_url AS "logoUrl",
        al.category::text AS category,
        al.platform::text AS platform,
        al.created_at AS "createdAt",
        u.display_name AS "displayName",
        u.image_url AS "imageUrl",
        u.github_username AS "githubUsername",
        (
          SELECT COUNT(*)::int
          FROM test_assignments ta
          WHERE ta.app_listing_id = al.id
            AND ta.status IN (
              'active'::"TestAssignmentStatus",
              'completed'::"TestAssignmentStatus"
            )
        ) AS testers,
        (
          SELECT COUNT(*)::int
          FROM tester_requests tr
          WHERE tr.app_listing_id = al.id
            AND (
              (
                tr.status = 'pending'::"TesterRequestStatus"
                AND tr.expires_at > NOW()
              )
              OR (
                tr.status = 'accepted'::"TesterRequestStatus"
                AND tr.test_assignment_id IS NULL
              )
            )
        ) AS requests
      FROM app_listings al
      INNER JOIN users u ON u.id = al.user_id
      WHERE al.status = 'open_for_testing'::"AppListingStatus"
      ORDER BY al.created_at DESC
    `;

    const apps: CachedApp[] = rows.map((row) => ({
      ...mapListingToApp(row),
      categoryKey: row.category,
      platformKey: row.platform,
      createdAt: new Date(row.createdAt).getTime(),
      requests: row.requests,
      developer: {
        displayName: row.displayName,
        imageUrl: row.imageUrl,
        profileHref: profilePath(row.githubUsername),
      },
    }));

    memoryCache = { expiresAt: now + BROWSE_APPS_TTL_MS, apps };
    return apps;
  } catch (err) {
    console.error("[browse-apps] query failed", err);
    return memoryCache?.apps ?? [];
  }
}

function applyBrowseFilters(
  apps: CachedApp[],
  filters: BrowseFilters
): App[] {
  let filtered = apps;

  if (filters.category) {
    filtered = filtered.filter((app) => app.categoryKey === filters.category);
  }
  if (filters.platform) {
    filtered = filtered.filter((app) => app.platformKey === filters.platform);
  }

  const sorted = [...filtered];
  if (filters.sort === "requested") {
    sorted.sort((a, b) => b.requests - a.requests || b.createdAt - a.createdAt);
  } else if (filters.sort === "needed") {
    sorted.sort(
      (a, b) => a.testers - b.testers || b.createdAt - a.createdAt
    );
  } else {
    sorted.sort((a, b) => b.createdAt - a.createdAt);
  }

  return sorted.map(
    ({ categoryKey: _c, platformKey: _p, createdAt: _t, requests: _r, ...app }) =>
      app
  );
}

/** Open listings for /browse — cached fetch, then filter/sort in memory. */
export async function getBrowseApps(
  filters: BrowseFilters = { sort: "newest" }
): Promise<App[]> {
  const apps = await loadBrowseApps();
  return applyBrowseFilters(apps, filters);
}
