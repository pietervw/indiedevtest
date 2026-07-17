import Link from "next/link";
import { AppBoard } from "@/components/app-board";
import { Button } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/ui/section";
import { getOptionalDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import {
  categoryLabel,
  platformLabel,
  profilePath,
  appPath,
} from "@/lib/mock-data";
import { canonicalMetadata, siteConfig } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  ...canonicalMetadata("/browse"),
  title: "Browse",
  description: `Browse open testing listings on ${siteConfig.name}.`,
};

export default async function BrowsePage() {
  const viewer = await getOptionalDbUser();

  const listings = process.env.DATABASE_URL
    ? await prisma.appListing.findMany({
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
        orderBy: { createdAt: "desc" },
      })
    : [];

  const apps = listings.map((listing) => ({
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
  }));

  return (
    <div className="flex-1 border-b-2 border-ink bg-grid">
      <Container className="py-14 md:py-20">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            className="mx-0 mb-0 max-w-2xl text-left"
            title="Browse"
            description="Apps open for testing from fellow indie developers."
          />
          {viewer ? (
            <Button href="/apps/new" size="sm" className="shrink-0 self-start sm:self-auto">
              + Add
            </Button>
          ) : null}
        </div>

        {apps.length > 0 ? (
          <AppBoard apps={apps} className="max-w-2xl" />
        ) : (
          <p className="max-w-lg text-lg text-ink-muted">
            No open listings yet.{" "}
            {viewer ? (
              <>
                <Link href="/apps/new" className="font-semibold text-ink underline">
                  List your app
                </Link>{" "}
                to get started.
              </>
            ) : (
              "Sign in to list an app or check back soon."
            )}
          </p>
        )}
      </Container>
    </div>
  );
}
