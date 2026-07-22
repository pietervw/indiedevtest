"use client";

import { useActionState } from "react";
import {
  submitTesterFeedback,
  type FeedbackState,
} from "@/app/actions/feedback";
import { SubmitButton } from "@/components/submit-button";
import { umamiEvent } from "@/lib/umami";

const initialState: FeedbackState = { ok: false, message: "" };

export function TesterFeedbackForm({ listingId }: { listingId: string }) {
  const action = submitTesterFeedback.bind(null, listingId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <section className="mt-10 max-w-2xl rounded-2xl border-2 border-ink bg-paper p-5 shadow-brutal">
      <h2 className="font-display text-xl font-extrabold">
        Private tester feedback
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Send bugs and testing notes directly to the developer. This is not
        public.
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <select
          name="severity"
          defaultValue="medium"
          className="h-11 rounded-lg border-2 border-ink bg-paper px-3 text-sm"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <input
          name="title"
          required
          minLength={3}
          maxLength={120}
          placeholder="Short issue title"
          className="h-11 w-full rounded-lg border-2 border-ink bg-paper px-3 text-sm"
        />
        <div>
          <label
            htmlFor="tester-feedback-device"
            className="mb-1 block text-sm font-semibold text-ink"
          >
            Device{" "}
            <span className="font-medium text-ink-muted">(optional)</span>
          </label>
          <input
            id="tester-feedback-device"
            name="device"
            maxLength={160}
            placeholder="e.g. Samsung Galaxy S24 Ultra"
            className="h-11 w-full rounded-lg border-2 border-ink bg-paper px-3 text-sm"
          />
        </div>
        <textarea
          name="details"
          required
          minLength={10}
          maxLength={4000}
          rows={4}
          placeholder="What happened?"
          className="w-full rounded-lg border-2 border-ink bg-paper p-3 text-sm"
        />
        <textarea
          name="steps"
          maxLength={4000}
          rows={3}
          placeholder="Steps to reproduce (optional)"
          className="w-full rounded-lg border-2 border-ink bg-paper p-3 text-sm"
        />
        <SubmitButton
          size="sm"
          pendingLabel="Sending…"
          {...umamiEvent("tester_feedback_send_click")}
        >
          Send private feedback
        </SubmitButton>
        {state.message ? (
          <p
            className={
              state.ok
                ? "text-sm font-semibold text-ink"
                : "text-sm font-semibold text-red-600"
            }
            role={state.ok ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
