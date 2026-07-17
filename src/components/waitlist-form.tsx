"use client";

import { useActionState, useState } from "react";
import { joinWaitlist, type WaitlistState } from "@/app/actions/waitlist";
import { SubmitButton } from "@/components/submit-button";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { cn } from "@/lib/utils";

const initialState: WaitlistState = { ok: false, message: "" };

export function WaitlistForm({ className }: { className?: string }) {
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [state, formAction] = useActionState(
    async (prev: WaitlistState, formData: FormData) => {
      const next = await joinWaitlist(prev, formData);
      if (!next.ok) {
        setTurnstileReset((n) => n + 1);
      }
      return next;
    },
    initialState
  );

  if (state.ok) {
    return (
      <p
        className={cn("font-display text-lg font-bold text-ink", className)}
        role="status"
      >
        {state.message}
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className={cn("flex w-full max-w-lg flex-col gap-3", className)}
    >
      <div className="hidden" aria-hidden="true">
        <label htmlFor="waitlist-company">Company</label>
        <input
          id="waitlist-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <label className="sr-only" htmlFor="waitlist-email">
        Email
      </label>
      <input
        id="waitlist-email"
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete="email"
        placeholder="you@indie.dev"
        className="h-14 w-full rounded-xl border-2 border-ink bg-paper px-4 font-medium text-ink placeholder:text-ink-muted shadow-brutal outline-none transition-shadow focus:shadow-brutal-brand-lg disabled:opacity-50"
      />

      <TurnstileWidget action="waitlist" resetKey={turnstileReset} />

      <SubmitButton
        size="lg"
        pendingLabel="Joining…"
        className="w-full sm:w-auto sm:min-w-[160px]"
      >
        Join waitlist
      </SubmitButton>

      {state.message ? (
        <p className="text-sm font-semibold text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
