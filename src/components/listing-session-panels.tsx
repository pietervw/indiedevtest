"use client";

import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  acceptTesterRequest,
  confirmTesterJoined,
  markTestComplete,
  markTestIncomplete,
  rejectTesterRequest,
  withdrawTesterRequest,
} from "@/app/actions/requests";
import { RequestToTestForm } from "@/components/request-to-test-form";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { WriteReviewForm } from "@/components/write-review-form";
import type { ListingSessionPayload } from "@/lib/listing-session";
import {
  editPath,
  profilePath,
  TESTING_PERIOD_MS,
  testingPeriodProgress,
} from "@/lib/mock-data";

type SessionState = {
  session: ListingSessionPayload | null;
  failed: boolean;
  refresh: () => Promise<void>;
};

const ListingSessionContext = createContext<SessionState>({
  session: null,
  failed: false,
  refresh: async () => {},
});

export function ListingSessionProvider({
  listingId,
  children,
}: {
  listingId: string;
  children: ReactNode;
}) {
  const [session, setSession] = useState<ListingSessionPayload | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/apps/${listingId}/session`, { signal });
      if (!res.ok) throw new Error("session fetch failed");
      const data = (await res.json()) as ListingSessionPayload;
      setSession(data);
      setFailed(false);
    } catch (err: unknown) {
      if (
        signal?.aborted ||
        (err instanceof DOMException && err.name === "AbortError")
      ) {
        return;
      }
      setFailed(true);
    }
  }, [listingId]);

  useEffect(() => {
    const controller = new AbortController();
    // Queue the initial request outside the effect's synchronous phase. This
    // avoids a cascading render while still letting the public RSC shell paint.
    queueMicrotask(() => void refresh(controller.signal));
    return () => controller.abort();
  }, [refresh]);

  const value = useMemo(
    () => ({ session, failed, refresh }),
    [session, failed, refresh]
  );

  return (
    <ListingSessionContext.Provider value={value}>
      {children}
    </ListingSessionContext.Provider>
  );
}

function useListingSession() {
  return useContext(ListingSessionContext);
}

type TesterInfo = {
  displayName: string;
  githubUsername: string;
  imageUrl: string | null;
};

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

/** Re-render once when `at` elapses so the complete button can unlock live. */
function useRerenderAt(at: number | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (at == null) return;
    const delay = at - Date.now();
    if (delay <= 0) return;
    const id = window.setTimeout(() => setTick((n) => n + 1), delay);
    return () => window.clearTimeout(id);
  }, [at]);
}

function OwnerAssignmentRow({
  assignment,
  afterAction,
}: {
  assignment: ListingSessionPayload["assignments"][number];
  afterAction: (fn: () => Promise<void>) => () => Promise<void>;
}) {
  const done = assignment.status === "completed";
  const progress = testingPeriodProgress(
    assignment.joinedAt,
    assignment.platform
  );
  const unlockAt =
    !done && !progress.canComplete
      ? new Date(assignment.joinedAt).getTime() + TESTING_PERIOD_MS
      : null;
  useRerenderAt(unlockAt);

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <TesterRow
        tester={assignment.tester}
        sub={
          done
            ? `Completed ${new Date(
                assignment.completedAt ?? assignment.joinedAt
              ).toLocaleDateString()}`
            : progress.label
              ? `${progress.label} · joined ${new Date(
                  assignment.joinedAt
                ).toLocaleDateString()}`
              : `Joined ${new Date(assignment.joinedAt).toLocaleDateString()}`
        }
      />
      <div className="flex shrink-0 items-center gap-2">
        {!done ? (
          <form action={afterAction(() => markTestComplete(assignment.id))}>
            <SubmitButton
              size="sm"
              pendingLabel="Marking…"
              disabled={!progress.canComplete}
            >
              Mark complete
            </SubmitButton>
          </form>
        ) : null}
        <form action={afterAction(() => markTestIncomplete(assignment.id))}>
          <SubmitButton size="sm" variant="secondary" pendingLabel="Marking…">
            Mark incomplete
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}

/** Top bar: Browse + Edit (owner only). */
export function ListingPageHeader({ listingId }: { listingId: string }) {
  const { session } = useListingSession();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold text-ink-muted">
        <Link href="/browse" className="transition-colors hover:text-ink">
          ← Browse
        </Link>
      </p>
      {session?.isOwner ? (
        <Button href={editPath(listingId)} size="sm" variant="secondary">
          Edit listing
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Tester request UI + owner management lists. Client-side so the public
 * listing RSC never calls Clerk auth() for public statuses.
 */
export function ListingSessionPanels({
  listingId,
  listingStatus,
}: {
  listingId: string;
  listingStatus: string;
}) {
  const router = useRouter();
  const { session, failed, refresh } = useListingSession();

  const acceptingRequests = listingStatus === "open_for_testing";
  const isOwner = session?.isOwner ?? false;
  const viewer = Boolean(session?.viewerId);

  /** Run a server action, then refresh session panels and the RSC shell (e.g. tester bar). */
  function afterAction(action: () => Promise<void>) {
    return async () => {
      await action();
      await refresh();
      router.refresh();
    };
  }

  return (
    <>
      {acceptingRequests && !isOwner ? (
        <div className="mt-10">
          {session == null && !failed ? (
            <p className="text-sm text-ink-muted">Checking sign-in…</p>
          ) : viewer ? (
            <RequestToTestForm
              listingId={listingId}
              existing={session?.viewerRequestStatus ?? null}
              onWithdraw={afterAction(() => withdrawTesterRequest(listingId))}
            />
          ) : (
            <p className="font-semibold text-ink-muted">
              Sign in from the header to request testing.
            </p>
          )}
        </div>
      ) : null}

      {session?.canWriteReview ? (
        <div className="mt-10">
          <WriteReviewForm listingId={listingId} />
        </div>
      ) : null}

      {session?.hasWrittenReview ? (
        <p className="mt-10 font-semibold text-ink-muted" role="status">
          You already reviewed this app — thanks.
        </p>
      ) : null}

      {isOwner && session && session.pendingRequests.length > 0 ? (
        <section className="mt-14 max-w-2xl">
          <h2 className="font-display text-xl font-extrabold text-ink">
            Tester requests{" "}
            <span className="text-ink-muted">
              ({session.pendingRequests.length})
            </span>
          </h2>
          <ul className="mt-6 divide-y-2 divide-line overflow-hidden rounded-2xl border-2 border-ink bg-paper">
            {session.pendingRequests.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <TesterRow tester={req.tester} sub={req.testerEmail} />
                <div className="flex shrink-0 items-center gap-2">
                  <form action={afterAction(() => acceptTesterRequest(req.id))}>
                    <SubmitButton size="sm" pendingLabel="Accepting…">
                      Accept
                    </SubmitButton>
                  </form>
                  <form action={afterAction(() => rejectTesterRequest(req.id))}>
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

      {isOwner && session && session.acceptedRequests.length > 0 ? (
        <section className="mt-14 max-w-2xl">
          <h2 className="font-display text-xl font-extrabold text-ink">
            Awaiting join{" "}
            <span className="text-ink-muted">
              ({session.acceptedRequests.length})
            </span>
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Accepted testers — once you&apos;ve added them to your Play Store /
            TestFlight track, confirm they joined.
          </p>
          <ul className="mt-6 divide-y-2 divide-line overflow-hidden rounded-2xl border-2 border-ink bg-paper">
            {session.acceptedRequests.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <TesterRow tester={req.tester} sub={req.testerEmail} />
                <form action={afterAction(() => confirmTesterJoined(req.id))}>
                  <SubmitButton size="sm" pendingLabel="Confirming…">
                    Confirm joined
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isOwner && session && session.assignments.length > 0 ? (
        <section className="mt-14 max-w-2xl">
          <h2 className="font-display text-xl font-extrabold text-ink">
            Tests{" "}
            <span className="text-ink-muted">({session.assignments.length})</span>
          </h2>
          <ul className="mt-6 divide-y-2 divide-line overflow-hidden rounded-2xl border-2 border-ink bg-paper">
            {session.assignments.map((assignment) => (
              <OwnerAssignmentRow
                key={assignment.id}
                assignment={assignment}
                afterAction={afterAction}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
