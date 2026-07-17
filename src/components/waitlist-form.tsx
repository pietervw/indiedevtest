"use client";

import { useActionState } from "react";
import { joinWaitlist, type WaitlistState } from "@/app/actions/waitlist";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const initialState: WaitlistState = { ok: false, message: "" };

export function WaitlistForm({ className }: { className?: string }) {
  const [state, formAction, pending] = useActionState(
    joinWaitlist,
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
      className={cn(
        "flex w-full max-w-lg flex-col gap-3 sm:flex-row sm:flex-wrap",
        className
      )}
    >
      <label className="sr-only" htmlFor="waitlist-email">
        Email
      </label>
      <input
        id="waitlist-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@indie.dev"
        disabled={pending}
        className="h-14 w-full flex-1 rounded-xl border-2 border-ink bg-paper px-4 font-medium text-ink placeholder:text-ink-muted shadow-brutal outline-none transition-shadow focus:shadow-brutal-brand-lg disabled:opacity-50 sm:min-w-[12rem]"
      />
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="shrink-0 sm:min-w-[160px]"
      >
        {pending ? "Joining…" : "Join waitlist"}
      </Button>
      {state.message ? (
        <p className="w-full text-sm font-semibold text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
