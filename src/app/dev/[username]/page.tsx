import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBoard } from "@/components/app-board";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/section";
import { prisma } from "@/lib/db";
import {
  categoryLabel,
  platformLabel,
  profilePath,
  appPath,
} from "@/lib/mock-data";
import { canonicalMetadata, siteConfig } from "@/lib/site";
import type { Metadata } from "next";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  return {
    ...canonicalMetadata(profilePath(decoded)),
    title: `${decoded} · Developer`,
    description: `${decoded}'s profile on ${siteConfig.name}.`,
  };
}

export default async function DevProfilePage({ params }: Props) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  if (!process.env.DATABASE_URL) {
    notFound();
  }

  const user = await prisma.user.findUnique({
    where: { githubUsername: decoded },
    include: {
      appListings: {
        where: {
          status: {
            in: ["open_for_testing", "closed_for_testing", "testing_complete", "launched"],
          },
        },
        include: {
          _count: {
            select: {
              testAssignments: {
                where: { status: { in: ["active", "completed"] } },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    notFound();
  }

  const apps = user.appListings.map((listing) => ({
    id: listing.id,
    name: listing.name,
    logoUrl: listing.logoUrl?.trim() || undefined,
    category: categoryLabel[listing.category] ?? listing.category,
    platform: platformLabel[listing.platform] ?? listing.platform,
    testers: listing._count.testAssignments,
    href: appPath(listing.id),
  }));

  return (
    <div className="flex-1 border-b-2 border-ink bg-grid">
      <Container className="py-14 md:py-20">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {user.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt=""
              width={96}
              height={96}
              className="size-24 rounded-2xl border-2 border-ink object-cover shadow-brutal"
            />
          ) : (
            <div className="flex size-24 items-center justify-center rounded-2xl border-2 border-ink bg-ink font-display text-4xl font-bold text-brand shadow-brutal">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
              {user.displayName}
            </h1>
            <p className="mt-1 text-ink-muted">
              <Link
                href={`https://github.com/${user.githubUsername}`}
                className="font-semibold text-ink underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                @{user.githubUsername}
              </Link>
              {user.twitterHandle ? (
                <>
                  {" · "}
                  <Link
                    href={`https://x.com/${user.twitterHandle}`}
                    className="font-semibold text-ink underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @{user.twitterHandle}
                  </Link>
                </>
              ) : null}
            </p>
            {user.bio ? (
              <p className="mt-4 max-w-xl text-lg text-ink-muted">{user.bio}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="dark" size="sm">
                {user.profileScoreJoined} joined
              </Badge>
              <Badge variant="muted" size="sm">
                {user.profileScoreCompleted} completed
              </Badge>
              <Badge variant="outline" size="sm">
                {user.reviewsWrittenCount} reviews
              </Badge>
            </div>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold text-ink">Apps</h2>
          {apps.length > 0 ? (
            <AppBoard apps={apps} className="mt-6 max-w-2xl" />
          ) : (
            <p className="mt-4 text-ink-muted">No public app listings yet.</p>
          )}
        </section>
      </Container>
    </div>
  );
}
