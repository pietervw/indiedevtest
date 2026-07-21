import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { PUBLIC_LISTING_STATUSES } from "@/lib/listing-status";
import { appPath, profilePath } from "@/lib/mock-data";
import { absoluteUrl, siteRoutes } from "@/lib/site";

/** Refresh sitemap at most hourly — listings change infrequently. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ogImage = absoluteUrl("/opengraph-image");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = siteRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    ...(route.path === "/" ? { images: [ogImage] } : {}),
  }));

  if (!process.env.DATABASE_URL) {
    return staticEntries;
  }

  try {
    const [listings, developers] = await Promise.all([
      prisma.appListing.findMany({
        where: { status: { in: [...PUBLIC_LISTING_STATUSES] } },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 5000,
      }),
      prisma.user.findMany({
        where: {
          appListings: {
            some: { status: { in: [...PUBLIC_LISTING_STATUSES] } },
          },
        },
        select: { profileSlug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 5000,
      }),
    ]);

    return [
      ...staticEntries,
      ...listings.map((listing) => ({
        url: absoluteUrl(appPath(listing.id)),
        lastModified: listing.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...developers.map((dev) => ({
        url: absoluteUrl(profilePath(dev.profileSlug)),
        lastModified: dev.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch (err) {
    console.error("[sitemap] failed to load dynamic URLs", err);
    return staticEntries;
  }
}
