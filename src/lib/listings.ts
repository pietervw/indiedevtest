import { prisma } from "@/lib/db";
import {
  TESTER_SLOT_MAX,
  appPath,
  categoryLabel,
  platformLabel,
  profilePath,
  type App,
} from "@/lib/mock-data";

/** Open listings nearest to a full tester roster (highest count first). */
export async function getTopAppsNeedingTesters(limit = 5): Promise<App[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  const listings = await prisma.appListing.findMany({
    where: { status: "open_for_testing" },
    include: {
      user: {
        select: {
          displayName: true,
          imageUrl: true,
          githubUsername: true,
        },
      },
      _count: {
        select: {
          testAssignments: {
            where: { status: { in: ["active", "completed"] } },
          },
        },
      },
    },
  });

  return listings
    .map((listing) => ({
      id: listing.id,
      name: listing.name,
      logoUrl: listing.logoUrl?.trim() || undefined,
      category: categoryLabel[listing.category] ?? listing.category,
      platform: platformLabel[listing.platform] ?? listing.platform,
      testers: listing._count.testAssignments,
      href: appPath(listing.id),
      developer: {
        displayName: listing.user.displayName,
        imageUrl: listing.user.imageUrl,
        profileHref: profilePath(listing.user.githubUsername),
      },
    }))
    .sort((a, b) => {
      // Prefer apps closest to a full slate of testers (under the soft max).
      const distA = Math.abs(TESTER_SLOT_MAX - a.testers);
      const distB = Math.abs(TESTER_SLOT_MAX - b.testers);
      if (distA !== distB) return distA - distB;
      // Tie-break: more testers first, then newer name for stability
      if (b.testers !== a.testers) return b.testers - a.testers;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}
