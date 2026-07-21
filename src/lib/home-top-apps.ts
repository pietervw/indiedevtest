import { prisma } from "@/lib/db";
import {
  TESTER_SLOT_MAX,
  mapListingToApp,
  profilePath,
  type App,
} from "@/lib/mock-data";

/** 5 hours — homepage board changes slowly; prefer speed over live counts. */
export const HOME_TOP_APPS_TTL_MS = 5 * 60 * 60 * 1000;

type HomeTopAppRow = {
  id: string;
  name: string;
  logoUrl: string;
  category: string;
  platform: string;
  displayName: string;
  imageUrl: string | null;
  profileSlug: string;
  testers: number;
};

type CacheEntry = {
  expiresAt: number;
  apps: App[];
};

/** Process-local memory cache (Coolify single instance). Cleared on mutate. */
let memoryCache: CacheEntry | null = null;

export function invalidateHomeTopAppsCache() {
  memoryCache = null;
}

/**
 * Homepage-only: top open listings nearest a full tester roster.
 * Single SQL round-trip (indexed) + in-memory cache (~5h).
 */
export async function getHomeTopAppsNeedingTesters(): Promise<App[]> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.apps;
  }

  if (!process.env.DATABASE_URL) {
    return memoryCache?.apps ?? [];
  }

  try {
    const rows = await prisma.$queryRaw<HomeTopAppRow[]>`
      SELECT
        al.id,
        al.name,
        al.logo_url AS "logoUrl",
        al.category::text AS category,
        al.platform::text AS platform,
        u.display_name AS "displayName",
        u.image_url AS "imageUrl",
        u.profile_slug AS "profileSlug",
        COUNT(ta.id)::int AS testers
      FROM app_listings al
      INNER JOIN users u ON u.id = al.user_id
      LEFT JOIN test_assignments ta
        ON ta.app_listing_id = al.id
        AND ta.status IN (
          'active'::"TestAssignmentStatus",
          'completed'::"TestAssignmentStatus"
        )
      WHERE al.status = 'open_for_testing'::"AppListingStatus"
      GROUP BY al.id, u.id
      ORDER BY
        ABS(${TESTER_SLOT_MAX} - COUNT(ta.id)) ASC,
        COUNT(ta.id) DESC,
        al.name ASC
      LIMIT 5
    `;

    const apps: App[] = rows.map((row) => ({
      ...mapListingToApp(row),
      developer: {
        displayName: row.displayName,
        imageUrl: row.imageUrl,
        profileHref: profilePath(row.profileSlug),
      },
    }));

    memoryCache = { expiresAt: now + HOME_TOP_APPS_TTL_MS, apps };
    return apps;
  } catch (err) {
    console.error("[home-top-apps] query failed", err);
    // Prefer last good snapshot over failing the homepage.
    return memoryCache?.apps ?? [];
  }
}
