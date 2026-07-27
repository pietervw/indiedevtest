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

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-current">
      <path d="M12 .7A11.5 11.5 0 0 0 8.36 23.1c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.74-1.55-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18a10.97 10.97 0 0 1 5.76 0c2.2-1.5 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05a4.45 4.45 0 0 1 1.19 3.09c0 4.41-2.7 5.38-5.28 5.67.42.36.79 1.06.79 2.14v3.25c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 fill-current">
      <path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.26-8.3L2.97 2h6.4l4.42 5.84L18.9 2Zm-1.1 17.84h1.73L8.43 4.05H6.58L17.8 19.84Z" />
    </svg>
  );
}

function StatTooltip({
  children,
  description,
  id,
  align = "center",
}: {
  children: React.ReactNode;
  description: string;
  id: string;
  align?: "left" | "center" | "right";
}) {
  const positionClass =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <span
      className="group relative inline-flex cursor-help outline-none"
      tabIndex={0}
      aria-describedby={id}
    >
      {children}
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute bottom-[calc(100%+0.5rem)] z-20 w-[min(14rem,calc(100vw-2rem))] rounded-lg border-2 border-ink bg-ink px-3 py-2 text-center font-sans text-xs font-medium leading-5 text-paper opacity-0 shadow-brutal transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${positionClass}`}
      >
        {description}
      </span>
    </span>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  const profile = await getDevProfile(decoded);

  if (!profile) {
    const legacyProfileSlug = await getProfileSlugForLegacyGithubUsername(decoded);
    if (legacyProfileSlug) {
      return canonicalMetadata(profilePath(legacyProfileSlug));
    }
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
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
              {user.githubId && user.githubLogin ? (
                <Link
                  href={`https://github.com/${user.githubLogin}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-ink underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GitHubIcon />
                  {user.githubLogin}
                </Link>
              ) : null}
              {user.twitterHandle ? (
                <Link
                  href={`https://x.com/${user.twitterHandle}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-ink underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <XIcon />
                  @{user.twitterHandle}
                </Link>
              ) : null}
              {user.trustMrrProfileUrl ? (
                <Link
                  href={user.trustMrrProfileUrl}
                  className="font-semibold text-ink underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  TrustMRR
                </Link>
              ) : null}
            </div>
            {user.bio ? (
              <p className="mt-4 max-w-xl text-lg text-ink-muted">{user.bio}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <StatTooltip
                id="joined-tooltip"
                align="left"
                description={`This developer joined ${user.profileScoreJoined} testing ${user.profileScoreJoined === 1 ? "track" : "tracks"}.`}
              >
                <Badge variant="dark" size="sm">
                  {user.profileScoreJoined} joined
                </Badge>
              </StatTooltip>
              <StatTooltip
                id="completed-tooltip"
                description={`This developer successfully completed ${user.profileScoreCompleted} testing ${user.profileScoreCompleted === 1 ? "track" : "tracks"}.`}
              >
                <Badge variant="muted" size="sm">
                  {user.profileScoreCompleted} completed
                </Badge>
              </StatTooltip>
              <StatTooltip
                id="feedback-tooltip"
                align="right"
                description={`This developer left ${user.reviewsWrittenCount} feedback ${user.reviewsWrittenCount === 1 ? "comment" : "comments"} for other developers.`}
              >
                <Badge variant="outline" size="sm">
                  {user.reviewsWrittenCount} feedback
                </Badge>
              </StatTooltip>
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
