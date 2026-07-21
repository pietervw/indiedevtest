import Link from "next/link";
import { acceptTesterRequest } from "@/app/actions/requests";
import { AppLogo } from "@/components/app-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import type {
  DashboardData,
  DashboardIncomingRequest,
  DashboardListing,
} from "@/lib/dashboard";
import { SubmitButton } from "@/components/submit-button";
import type { Platform } from "@/generated/prisma";
import {
  TESTER_SLOT_MAX,
  appPath,
  categoryLabel,
  editPath,
  platformLabel,
  statusLabel,
} from "@/lib/mock-data";

function activeAssignmentMeta(item: {
  platform: Platform;
  daysRemainingLabel: string | null;
}) {
  const platform = platformLabel[item.platform] ?? item.platform;
  if (item.daysRemainingLabel) {
    return `${platform} · ${item.daysRemainingLabel}`;
  }
  return `${platform} · In progress`;
}

export function DashboardActivity({
  displayName,
  data,
}: {
  displayName: string;
  data: DashboardData;
}) {
  const hasListings = data.listings.length > 0;
  const hasTestingActivity =
    data.pendingRequests.length > 0 ||
    data.acceptedAwaitingJoin.length > 0 ||
    data.activeAssignments.length > 0 ||
    data.completedAssignments.length > 0 ||
    data.incompleteAssignments.length > 0;

  return (
    <div className="flex-1 bg-grid">
      <Container className="py-14 md:py-20">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-3 text-lg text-ink-muted">
              Welcome back, {displayName}. Your apps and testing activity in one
              place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="/browse" size="sm" variant="secondary">
              Browse apps
            </Button>
            <Button href="/apps/new" size="sm">
              + List an app
            </Button>
          </div>
        </div>

        <section aria-labelledby="your-apps-heading">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2
              id="your-apps-heading"
              className="font-display text-2xl font-extrabold text-ink"
            >
              Your apps
            </h2>
            {hasListings ? (
              <p className="text-sm font-semibold text-ink-muted">
                {data.listings.length} listing
                {data.listings.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>

          {hasListings ? (
            <ul className="divide-y-2 divide-ink overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-brutal">
              {data.listings.map((listing) => (
                <ListingRow key={listing.id} listing={listing} />
              ))}
            </ul>
          ) : (
            <EmptyPanel>
              <p className="text-lg text-ink-muted">
                You haven&apos;t listed an app yet. Post a draft and open it for
                testing when you&apos;re ready.
              </p>
              <Button href="/apps/new" size="sm" className="mt-4">
                List your first app
              </Button>
            </EmptyPanel>
          )}
        </section>

        {data.incomingRequests.length > 0 ? (
          <section aria-labelledby="incoming-requests-heading" className="mt-14">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2
                id="incoming-requests-heading"
                className="font-display text-2xl font-extrabold text-ink"
              >
                Tester requests
              </h2>
              <p className="text-sm font-semibold text-ink-muted">
                {data.incomingRequests.length} awaiting your decision
              </p>
            </div>
            <ul className="divide-y-2 divide-ink overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-brutal">
              {data.incomingRequests.map((request) => (
                <IncomingRequestRow key={request.id} request={request} />
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="testing-heading" className="mt-14">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2
              id="testing-heading"
              className="font-display text-2xl font-extrabold text-ink"
            >
              Your testing
            </h2>
          </div>

          {hasTestingActivity ? (
            <div className="space-y-8">
              {data.pendingRequests.length > 0 ? (
                <ActivityGroup title="Pending requests">
                  {data.pendingRequests.map((item) => (
                    <ActivityRow
                      key={item.id}
                      href={appPath(item.listing.id)}
                      name={item.listing.name}
                      logoUrl={item.listing.logoUrl}
                      badge="Awaiting decision"
                      meta={`${platformLabel[item.listing.platform] ?? item.listing.platform} · Requested`}
                    />
                  ))}
                </ActivityGroup>
              ) : null}
              {data.acceptedAwaitingJoin.length > 0 ? (
                <ActivityGroup title="Accepted — awaiting join">
                  {data.acceptedAwaitingJoin.map((item) => (
                    <ActivityRow
                      key={item.id}
                      href={appPath(item.listing.id)}
                      name={item.listing.name}
                      logoUrl={item.listing.logoUrl}
                      badge="Join the track"
                      meta={`${platformLabel[item.listing.platform] ?? item.listing.platform} · Accepted`}
                    />
                  ))}
                </ActivityGroup>
              ) : null}
              {data.activeAssignments.length > 0 ? (
                <ActivityGroup title="Active tests">
                  {data.activeAssignments.map((item) => (
                    <ActivityRow
                      key={item.id}
                      href={appPath(item.listing.id)}
                      name={item.listing.name}
                      logoUrl={item.listing.logoUrl}
                      badge="Active"
                      meta={activeAssignmentMeta(item)}
                    />
                  ))}
                </ActivityGroup>
              ) : null}
              {data.completedAssignments.length > 0 ? (
                <ActivityGroup title="Completed">
                  {data.completedAssignments.map((item) => (
                    <ActivityRow
                      key={item.id}
                      href={appPath(item.listing.id)}
                      name={item.listing.name}
                      logoUrl={item.listing.logoUrl}
                      badge="Completed"
                      meta={`${platformLabel[item.platform] ?? item.platform} · Done`}
                    />
                  ))}
                </ActivityGroup>
              ) : null}
              {data.incompleteAssignments.length > 0 ? (
                <ActivityGroup title="Incomplete">
                  {data.incompleteAssignments.map((item) => (
                    <ActivityRow
                      key={item.id}
                      href={appPath(item.listing.id)}
                      name={item.listing.name}
                      logoUrl={item.listing.logoUrl}
                      badge="Incomplete"
                      meta={`${platformLabel[item.platform] ?? item.platform} · Ended early`}
                    />
                  ))}
                </ActivityGroup>
              ) : null}
            </div>
          ) : (
            <EmptyPanel>
              <p className="text-lg text-ink-muted">
                You haven&apos;t requested to test anything yet. Browse open
                listings and help a fellow indie ship.
              </p>
              <Button href="/browse" size="sm" className="mt-4">
                Browse apps to test
              </Button>
            </EmptyPanel>
          )}
        </section>
      </Container>
    </div>
  );
}

function IncomingRequestRow({ request }: { request: DashboardIncomingRequest }) {
  const approve = acceptTesterRequest.bind(null, request.id);

  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <AppLogo name={request.listing.name} logoUrl={request.listing.logoUrl} size="sm" />
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-ink">
            {request.tester.displayName} wants to test {request.listing.name}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {platformLabel[request.listing.platform] ?? request.listing.platform}{" · "}
            <a href={`mailto:${request.testerEmail}`} className="font-semibold text-ink underline">
              {request.testerEmail}
            </a>
          </p>
          <Link
            href={appPath(request.listing.id)}
            className="mt-2 inline-block text-sm font-semibold text-ink underline"
          >
            View listing
          </Link>
        </div>
      </div>
      <form action={approve} className="shrink-0">
        <SubmitButton size="sm" pendingLabel="Approving…">
          Approve tester
        </SubmitButton>
      </form>
    </li>
  );
}

function ListingRow({ listing }: { listing: DashboardListing }) {
  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <AppLogo name={listing.name} logoUrl={listing.logoUrl} size="sm" />
        <div className="min-w-0">
          <Link
            href={appPath(listing.id)}
            className="font-display text-lg font-bold text-ink underline-offset-2 hover:underline"
          >
            {listing.name}
          </Link>
          <div className="mt-2 flex flex-wrap gap-2">
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
          <p className="mt-2 text-sm text-ink-muted">
            {listing.liveTesterCount}/{TESTER_SLOT_MAX} live testers
            {" · "}
            {listing.pendingRequestCount} pending request
            {listing.pendingRequestCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        <Button href={appPath(listing.id)} size="sm" variant="secondary">
          Manage
        </Button>
        <Button href={editPath(listing.id)} size="sm" variant="ghost">
          Edit
        </Button>
      </div>
    </li>
  );
}

function ActivityGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-display text-lg font-extrabold text-ink">{title}</h3>
      <ul className="mt-3 divide-y-2 divide-ink overflow-hidden rounded-2xl border-2 border-ink bg-paper">
        {children}
      </ul>
    </div>
  );
}

function ActivityRow({
  href,
  name,
  logoUrl,
  badge,
  meta,
}: {
  href: string;
  name: string;
  logoUrl: string;
  badge: string;
  meta: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 p-4 transition-colors hover:bg-paper-muted sm:px-5"
      >
        <AppLogo name={name} logoUrl={logoUrl} size="xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold text-ink">{name}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{meta}</p>
        </div>
        <Badge variant="outline" size="sm" className="shrink-0">
          {badge}
        </Badge>
      </Link>
    </li>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-ink/40 bg-paper px-5 py-8">
      {children}
    </div>
  );
}
