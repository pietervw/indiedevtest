"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createTesterRequest, type RequestState } from "@/app/actions/requests";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import type { TesterRequestStatus } from "@/generated/prisma";

const initialState: RequestState = { ok: false, message: "" };

/**
 * Tester-facing request button. Contact email is collected once in profile
 * setup, then the server snapshots it onto each request for audit/history.
 */
export function RequestToTestForm({
  listingId,
  existing,
  hasJoined = false,
  invitation = null,
  onWithdraw,
  onRequestSuccess,
}: {
  listingId: string;
  existing: TesterRequestStatus | null;
  /** Owner already confirmed join — withdraw is no longer allowed. */
  hasJoined?: boolean;
  invitation?: {
    testingAccessUrl: string | null;
    testerInstructions: string | null;
    developerContactEmail: string | null;
  } | null;
  onWithdraw?: () => Promise<void>;
  /** Refresh listing session after a successful create so status stays authoritative. */
  onRequestSuccess?: () => void;
}) {
  const router = useRouter();
  const action = createTesterRequest.bind(null, listingId);
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (!state.ok) return;
    onRequestSuccess?.();
    router.refresh();
  }, [state.ok, onRequestSuccess, router]);

  // Session status wins over optimistic state.ok so an accept cannot stay
  // masked behind a stale "waiting" / pending-withdraw UI.
  if (existing === "accepted") {
    return (
      <div>
        <p className="font-display text-lg font-bold text-ink">You&apos;re in! 🎉</p>
        {invitation?.testingAccessUrl || invitation?.testerInstructions ? (
          <div className="mt-4 rounded-xl border-2 border-ink bg-paper-muted p-4 text-sm text-ink">
            <p className="font-display text-base font-bold">Your testing invitation</p>
            {invitation.testerInstructions ? (
              <p className="mt-2 whitespace-pre-wrap text-ink-muted">
                {invitation.testerInstructions}
              </p>
            ) : null}
            {invitation.testingAccessUrl ? (
              <a
                href={invitation.testingAccessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4"
              >
                Open testing access link ↗
              </a>
            ) : null}
            {invitation.developerContactEmail ? (
              <p className="mt-3 text-ink-muted">
                Need help joining? Contact the developer at{" "}
                <a
                  href={`mailto:${invitation.developerContactEmail}`}
                  className="font-semibold text-ink underline"
                >
                  {invitation.developerContactEmail}
                </a>
                .
              </p>
            ) : null}
          </div>
        ) : null}
        {hasJoined ? (
          <p className="mt-1 text-sm text-ink-muted">
            You&apos;re on the testing track for this app.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-muted">
              {invitation?.testingAccessUrl || invitation?.testerInstructions
                ? "Use the invitation above, then wait for the developer to confirm you joined."
                : "The developer will email you next steps to join the testing track."}
            </p>
            {onWithdraw ? (
              <form action={onWithdraw} className="mt-3">
                <SubmitButton
                  size="sm"
                  variant="secondary"
                  pendingLabel="Withdrawing…"
                >
                  Can&apos;t test after all
                </SubmitButton>
              </form>
            ) : null}
          </>
        )}
      </div>
    );
  }

  if (existing === "pending" || state.ok) {
    return (
      <div>
        <p className="font-display text-lg font-bold text-ink">
          Request sent — waiting for the developer to respond.
        </p>
        {onWithdraw ? (
          <form action={onWithdraw} className="mt-3">
            <SubmitButton size="sm" variant="secondary" pendingLabel="Withdrawing…">
              Withdraw request
            </SubmitButton>
          </form>
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h2 className="font-display text-xl font-extrabold text-ink">
        Request to test
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        Your saved testing contact email will be shared with this developer so
        they can add you to their Play Store / TestFlight track.
      </p>
      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <SubmitButton size="lg" pendingLabel="Sending…" className="w-full sm:w-auto">
          Request to test
        </SubmitButton>
        {state.message ? (
          <p
            className={cn(
              "text-sm font-semibold",
              state.ok ? "text-ink" : "text-red-600"
            )}
            role={state.ok ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}
      </form>
      {existing === "rejected" || existing === "expired" ? (
        <p className="mt-3 text-xs text-ink-muted">
          Your last request{" "}
          {existing === "rejected" ? "was declined" : "expired"}. You can request
          again.
        </p>
      ) : null}
    </div>
  );
}
