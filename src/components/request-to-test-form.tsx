"use client";

import { useActionState } from "react";
import { createTesterRequest, type RequestState } from "@/app/actions/requests";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import type { TesterRequestStatus } from "@/generated/prisma";

const initialState: RequestState = { ok: false, message: "" };

const inputClassName =
  "h-14 w-full rounded-xl border-2 border-ink bg-paper px-4 font-medium text-ink shadow-brutal outline-none transition-shadow placeholder:text-ink-muted focus:shadow-brutal-brand-lg disabled:opacity-50";

/**
 * Tester-facing "Request to test" form. When the viewer already has an active
 * request we surface its state instead of the form; declined/expired requests
 * can be re-submitted.
 */
export function RequestToTestForm({
  listingId,
  existing,
}: {
  listingId: string;
  existing: TesterRequestStatus | null;
}) {
  const action = createTesterRequest.bind(null, listingId);
  const [state, formAction] = useActionState(action, initialState);

  if (existing === "pending") {
    return (
      <p className="font-display text-lg font-bold text-ink">
        Request sent — waiting for the developer to respond.
      </p>
    );
  }

  if (existing === "accepted") {
    return (
      <div>
        <p className="font-display text-lg font-bold text-ink">You&apos;re in! 🎉</p>
        <p className="mt-1 text-sm text-ink-muted">
          The developer will email you next steps to join the testing track.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h2 className="font-display text-xl font-extrabold text-ink">
        Request to test
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        Share your email so the developer can add you to their Play Store /
        TestFlight track. Everything else happens off-platform over email.
      </p>
      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <label className="sr-only" htmlFor="request-email">
          Your email
        </label>
        <input
          id="request-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@indie.dev"
          className={cn(
            inputClassName,
            state.fieldErrors?.email ? "border-red-600" : ""
          )}
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        {state.fieldErrors?.email ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {state.fieldErrors.email}
          </p>
        ) : null}
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
