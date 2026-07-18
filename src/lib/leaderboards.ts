import { prisma } from "@/lib/db";
import { profilePath } from "@/lib/mock-data";

const LEADERBOARDS_TTL_MS = 15 * 60 * 1000;
const LEADERBOARD_LIMIT = 5;

export type LeaderboardEntry = {
  displayName: string;
  imageUrl: string | null;
  profileHref: string;
  value: number;
};

export type Leaderboards = {
  mostTested: LeaderboardEntry[];
  mostLaunched: LeaderboardEntry[];
  mostReviews: LeaderboardEntry[];
};

type RankRow = {
  displayName: string;
  imageUrl: string | null;
  githubUsername: string;
  value: number;
};

type CacheEntry = {
  expiresAt: number;
  boards: Leaderboards;
};

let memoryCache: CacheEntry | null = null;

export function invalidateLeaderboardsCache() {
  memoryCache = null;
}

function toEntries(rows: RankRow[]): LeaderboardEntry[] {
  return rows.map((row) => ({
    displayName: row.displayName,
    imageUrl: row.imageUrl,
    profileHref: profilePath(row.githubUsername),
    value: row.value,
  }));
}

async function loadLeaderboards(): Promise<Leaderboards> {
  const [mostTested, mostLaunched, mostReviews] = await Promise.all([
    prisma.user.findMany({
      where: { profileScoreCompleted: { gt: 0 } },
      orderBy: [{ profileScoreCompleted: "desc" }, { createdAt: "asc" }],
      take: LEADERBOARD_LIMIT,
      select: {
        displayName: true,
        imageUrl: true,
        githubUsername: true,
        profileScoreCompleted: true,
      },
    }),
    prisma.$queryRaw<RankRow[]>`
      SELECT
        u.display_name AS "displayName",
        u.image_url AS "imageUrl",
        u.github_username AS "githubUsername",
        COUNT(al.id)::int AS value
      FROM users u
      INNER JOIN app_listings al
        ON al.user_id = u.id
        AND al.status = 'launched'::"AppListingStatus"
      GROUP BY u.id
      ORDER BY value DESC, u.created_at ASC
      LIMIT ${LEADERBOARD_LIMIT}
    `,
    prisma.user.findMany({
      where: { reviewsWrittenCount: { gt: 0 } },
      orderBy: [{ reviewsWrittenCount: "desc" }, { createdAt: "asc" }],
      take: LEADERBOARD_LIMIT,
      select: {
        displayName: true,
        imageUrl: true,
        githubUsername: true,
        reviewsWrittenCount: true,
      },
    }),
  ]);

  return {
    mostTested: toEntries(
      mostTested.map((u) => ({
        displayName: u.displayName,
        imageUrl: u.imageUrl,
        githubUsername: u.githubUsername,
        value: u.profileScoreCompleted,
      }))
    ),
    mostLaunched: toEntries(mostLaunched),
    mostReviews: toEntries(
      mostReviews.map((u) => ({
        displayName: u.displayName,
        imageUrl: u.imageUrl,
        githubUsername: u.githubUsername,
        value: u.reviewsWrittenCount,
      }))
    ),
  };
}

export async function getLeaderboards(): Promise<Leaderboards> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.boards;
  }

  const empty: Leaderboards = {
    mostTested: [],
    mostLaunched: [],
    mostReviews: [],
  };

  if (!process.env.DATABASE_URL) {
    return memoryCache?.boards ?? empty;
  }

  try {
    const boards = await loadLeaderboards();
    memoryCache = { expiresAt: now + LEADERBOARDS_TTL_MS, boards };
    return boards;
  } catch (err) {
    console.error("[leaderboards] query failed", err);
    return memoryCache?.boards ?? empty;
  }
}
