import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppLogo } from "@/components/app-logo";
import { RequestToTestForm } from "@/components/request-to-test-form";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { ProgressBar } from "@/components/ui/progress";
import {
  acceptTesterRequest,
  confirmTesterJoined,
  markTestComplete,
  markTestIncomplete,
  rejectTesterRequest,
} from "@/app/actions/requests";
import { getOptionalDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import {
  TESTER_SLOT_MAX,
  appPath,
  categoryLabel,
  platformLabel,
  profilePath,
  statusLabel,
} from "@/lib/mock-data";
import { canonicalMetadata, siteConfig } from "@/lib/site";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

const PUBLIC_STATUSES = [
  "open_for_testing",
  "closed_for_testing",
  "testing_complete",
  "launched",
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!process.env.DATABASE_URL) {
    return { title: "App" };
  }

  const listing = await prisma.appListing.findUnique({
    where: { id },
    select: { name: true, description: true, status: true },
  });

  if (!listing) {
    return { title: "App not found" };
  }

  return {
    ...canonicalMetadata(appPath(id)),
    title: listing.name,
    description: listing.description.slice(0, 160),
    ...(listing.status === "draft"
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}

export default async function AppListingPage({ params }: Props) {
  const { id } = await params;

  if (!process.env.DATABASE_URL) {
    notFound();
  }

  const viewer = await getOptionalDbUser();

  const listing = await prisma.appListing.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          imageUrl: true,
          githubUsername: true,
        },
      },
      reviews: {
        include: {
          tester: {
            select: {
              displayName: true,
              imageUrl: true,
              githubUsername: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
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

  if (!listing) {
    notFound();
  }

  const isOwner = Boolean(viewer && viewer.id === listing.userId);
  const isPublic = (PUBLIC_STATUSES as readonly string[]).includes(
    listing.status
  );

  if (!isPublic && !isOwner) {
    notFound();
  }

  const viewerRequest =
    viewer && !isOwner
      ? await prisma.testerRequest.findUnique({
          where: {
            appListingId_testerUserId: {
              appListingId: listing.id,
              testerUserId: viewer.id,
            },
          },
          select: { status: true },
        })
      : null;

  const pendingRequests = isOwner
    ? await prisma.testerRequest.findMany({
        where: { appListingId: listing.id, status: "pending" },
        include: {
          tester: {
            select: { displayName: true, githubUsername: true, imageUrl: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Accepted testers the dev hasn't confirmed as joined yet.
  const acceptedRequests = isOwner
    ? await prisma.testerRequest.findMany({
        where: {
          appListingId: listing.id,
          status: "accepted",
          testAssignmentId: null,
        },
        include: {
          tester: {
            select: { displayName: true, githubUsername: true, imageUrl: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Tests in progress (tester has joined, not yet marked complete/incomplete).
  const activeAssignments = isOwner
    ? await prisma.testAssignment.findMany({
        where: { appListingId: listing.id, status: "active" },
        include: {
          tester: {
            select: { displayName: true, githubUsername: true, imageUrl: true },
          },
        },
        orderBy: { joinedAt: "desc" },
      })
    : [];

  const testers = listing._count.testAssignments;
  const showReviews =
    listing.status === "open_for_testing" ||
    listing.status === "closed_for_testing";
  const acceptingRequests = listing.status === "open_for_testing";
  const profileHref = profilePath(listing.user.githubUsername);

  return (
    <div className="flex-1 border-b-2 border-ink bg-grid">
      <Container className="py-14 md:py-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink-muted">
            <Link href="/browse" className="transition-colors hover:text-ink">
              ← Browse
            </Link>
          </p>
          {isOwner ? (
            <Button href={`/apps/${listing.id}/edit`} size="sm" variant="secondary">
              Edit listing
            </Button>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
          <AppLogo name={listing.name} logoUrl={listing.logoUrl} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="dark" size="sm">
                {statusLabel[listing.status] ?? listing.status}
              </Badge>
              <Badge variant="outline" size="sm">
                {categoryLabel[listing.category] ?? listing.category}
              </Badge>
              <Badge variant="muted" size="sm">
                {platformLabel[listing.platform] ?? listing.platform}
              </Badge>
            </div>

            <h1 className="mt-3 font-display text-3xl font-extrabold text-ink sm:text-4xl">
              {listing.name}
            </h1>

            <Link
              href={profileHref}
              className="mt-3 inline-flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              {listing.user.imageUrl ? (
                <Image
                  src={listing.user.imageUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 rounded-full border-2 border-ink object-cover"
                />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-full border-2 border-ink bg-paper-muted text-sm font-bold">
                  {listing.user.displayName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="font-semibold text-ink">
                {listing.user.displayName}
              </span>
              <span className="text-sm text-ink-muted">
                @{listing.user.githubUsername}
              </span>
            </Link>

            <div className="mt-6 max-w-xs">
              <div className="mb-1 flex justify-between font-display text-sm font-bold text-ink">
                <span>Testers</span>
                <span>
                  {testers}/{TESTER_SLOT_MAX}
                </span>
              </div>
              <ProgressBar value={testers} />
            </div>
          </div>
        </div>

        <div className="mt-10 max-w-2xl">
          <h2 className="font-display text-xl font-extrabold text-ink">
            About
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed text-ink-muted">
            {listing.description}
          </p>
        </div>

        {listing.status === "launched" && listing.storeLink ? (
          <div className="mt-8">
            <Button href={listing.storeLink} size="md" variant="dark">
              View on store
            </Button>
          </div>
        ) : null}

        {acceptingRequests && !isOwner ? (
          <div className="mt-10">
            {viewer ? (
              <RequestToTestForm
                listingId={listing.id}
                existing={viewerRequest?.status ?? null}
              />
            ) : (
              <p className="font-semibold text-ink-muted">
                Sign in from the header to request testing.
              </p>
            )}
          </div>
        ) : null}

        {isOwner && pendingRequests.length > 0 ? (
          <section className="mt-14 max-w-2xl">
            <h2 className="font-display text-xl font-extrabold text-ink">
              Tester requests{" "}
              <span className="text-ink-muted">
                ({pendingRequests.length})
              </span>
            </h2>
            <ul className="mt-6 divide-y-2 divide-line overflow-hidden rounded-2xl border-2 border-ink bg-paper">
              {pendingRequests.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <TesterRow tester={req.tester} sub={req.testerEmail} />
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={acceptTesterRequest.bind(null, req.id)}>
                      <SubmitButton size="sm" pendingLabel="Accepting…">
                        Accept
                      </SubmitButton>
                    </form>
                    <form action={rejectTesterRequest.bind(null, req.id)}>
                      <SubmitButton
                        size="sm"
                        variant="secondary"
                        pendingLabel="Declining…"
                      >
                        Decline
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {isOwner && acceptedRequests.length > 0 ? (
          <section className="mt-14 max-w-2xl">
            <h2 className="font-display text-xl font-extrabold text-ink">
              Awaiting join{" "}
              <span className="text-ink-muted">
                ({acceptedRequests.length})
              </span>
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Accepted testers — once you&apos;ve added them to your Play Store /
              TestFlight track, confirm they joined.
            </p>
            <ul className="mt-6 divide-y-2 divide-line overflow-hidden rounded-2xl border-2 border-ink bg-paper">
              {acceptedRequests.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <TesterRow tester={req.tester} sub={req.testerEmail} />
                  <form action={confirmTesterJoined.bind(null, req.id)}>
                    <SubmitButton size="sm" pendingLabel="Confirming…">
                      Confirm joined
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {isOwner && activeAssignments.length > 0 ? (
          <section className="mt-14 max-w-2xl">
            <h2 className="font-display text-xl font-extrabold text-ink">
              Active tests{" "}
              <span className="text-ink-muted">
                ({activeAssignments.length})
              </span>
            </h2>
            <ul className="mt-6 divide-y-2 divide-line overflow-hidden rounded-2xl border-2 border-ink bg-paper">
              {activeAssignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <TesterRow
                    tester={assignment.tester}
                    sub={`Joined ${new Date(assignment.joinedAt).toLocaleDateString()}`}
                  />
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={markTestComplete.bind(null, assignment.id)}>
                      <SubmitButton size="sm" pendingLabel="Marking…">
                        Mark complete
                      </SubmitButton>
                    </form>
                    <form action={markTestIncomplete.bind(null, assignment.id)}>
                      <SubmitButton
                        size="sm"
                        variant="secondary"
                        pendingLabel="Marking…"
                      >
                        Mark incomplete
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {showReviews ? (
          <section className="mt-14 max-w-2xl">
            <h2 className="font-display text-xl font-extrabold text-ink">
              Reviews
            </h2>
            {listing.reviews.length > 0 ? (
              <ul className="mt-6 divide-y-2 divide-line overflow-hidden rounded-2xl border-2 border-ink bg-paper">
                {listing.reviews.map((review) => (
                  <li key={review.id} className="px-5 py-4">
                    <Link
                      href={profilePath(review.tester.githubUsername)}
                      className="inline-flex items-center gap-2 font-semibold text-ink hover:underline"
                    >
                      {review.tester.displayName}
                    </Link>
                    <p className="mt-2 text-ink-muted">{review.content}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-ink-muted">No reviews yet.</p>
            )}
          </section>
        ) : null}

        <p className="mt-12 text-sm text-ink-muted">
          On {siteConfig.name} · listed for reciprocal testing
        </p>
      </Container>
    </div>
  );
}

type TesterInfo = {
  displayName: string;
  githubUsername: string;
  imageUrl: string | null;
};

/** Shared avatar + linked name row used across the owner request/test lists. */
function TesterRow({ tester, sub }: { tester: TesterInfo; sub?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {tester.imageUrl ? (
        <Image
          src={tester.imageUrl}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-xl border-2 border-ink object-cover"
        />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-paper-muted font-display text-lg font-bold text-ink">
          {tester.displayName.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <Link
          href={profilePath(tester.githubUsername)}
          className="font-semibold text-ink hover:underline"
        >
          {tester.displayName}
        </Link>
        {sub ? <p className="truncate text-sm text-ink-muted">{sub}</p> : null}
      </div>
    </div>
  );
}
