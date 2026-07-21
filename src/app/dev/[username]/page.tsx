import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { AppBoard } from "@/components/app-board";
import { ProfileBadges } from "@/components/profile-badges";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/section";
import {
  getDevProfile,
  getProfileSlugForLegacyGithubUsername,
} from "@/lib/dev-profile";
import { profilePath } from "@/lib/mock-data";
import { canonicalMetadata, siteConfig } from "@/lib/site";
import type { Metadata } from "next";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  const profile = await getDevProfile(decoded);

  if (!profile) {
    return {
      ...canonicalMetadata(profilePath(decoded)),
      title: `${decoded} · Developer`,
      description: `${decoded}'s profile on ${siteConfig.name}.`,
    };
  }

  const description =
    profile.bio?.trim().slice(0, 160) ||
    `${profile.displayName}${profile.githubLogin ? ` (@${profile.githubLogin})` : ""} on ${siteConfig.name} — ${profile.apps.length} app${profile.apps.length === 1 ? "" : "s"}, ${profile.profileScoreCompleted} tests completed.`;

  return {
    ...canonicalMetadata(profilePath(profile.profileSlug)),
    title: `${profile.displayName} · Developer`,
    description,
  };
}

export default async function DevProfilePage({ params }: Props) {
  await connection();
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  const user = await getDevProfile(decoded);

  if (!user) {
    const legacyProfileSlug = await getProfileSlugForLegacyGithubUsername(decoded);
    if (legacyProfileSlug) {
      permanentRedirect(profilePath(legacyProfileSlug));
    }
    notFound();
  }

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
              {user.githubId && user.githubLogin ? (
                <Link
                  href={`https://github.com/${user.githubLogin}`}
                  className="font-semibold text-ink underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @{user.githubLogin}
                </Link>
              ) : null}
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

        <ProfileBadges badges={user.badges} className="mt-12" />

        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold text-ink">Apps</h2>
          {user.apps.length > 0 ? (
            <AppBoard apps={user.apps} className="mt-6 max-w-2xl" />
          ) : (
            <p className="mt-4 text-ink-muted">No public app listings yet.</p>
          )}
        </section>
      </Container>
    </div>
  );
}
