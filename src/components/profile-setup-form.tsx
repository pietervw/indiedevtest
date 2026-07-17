"use client";

import { useActionState } from "react";
import {
  completeProfileSetup,
  skipProfileSetup,
  type ProfileSetupState,
} from "@/app/actions/profile";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

const initialState: ProfileSetupState = { ok: false, message: "" };

const fieldClassName =
  "w-full rounded-xl border-2 border-ink bg-paper px-4 font-medium text-ink shadow-brutal outline-none transition-shadow placeholder:text-ink-muted focus:shadow-brutal-brand-lg disabled:opacity-50";

const labelClassName = "mb-1.5 block text-sm font-semibold text-ink";

export function ProfileSetupForm({ className }: { className?: string }) {
  const [state, formAction] = useActionState(completeProfileSetup, initialState);

  return (
    <div className={cn("w-full max-w-xl", className)}>
      <form action={formAction} className="flex flex-col gap-5">
        <div>
          <label htmlFor="profile-bio" className={labelClassName}>
            Short bio{" "}
            <span className="font-medium text-ink-muted">(optional)</span>
          </label>
          <textarea
            id="profile-bio"
            name="bio"
            maxLength={280}
            rows={3}
            placeholder="Indie Android dev. Shipping small tools. Always down to test."
            className={cn(fieldClassName, "resize-y py-3")}
            aria-invalid={Boolean(state.fieldErrors?.bio)}
          />
          <p className="mt-1 text-sm text-ink-muted">Max 280 characters.</p>
          {state.fieldErrors?.bio ? (
            <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
              {state.fieldErrors.bio}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="profile-twitter" className={labelClassName}>
            X / Twitter handle{" "}
            <span className="font-medium text-ink-muted">(optional)</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-ink-muted">
              @
            </span>
            <input
              id="profile-twitter"
              name="twitterHandle"
              type="text"
              maxLength={16}
              autoComplete="off"
              spellCheck={false}
              placeholder="yourhandle"
              className={cn(fieldClassName, "h-12 pl-8")}
              aria-invalid={Boolean(state.fieldErrors?.twitterHandle)}
            />
          </div>
          {state.fieldErrors?.twitterHandle ? (
            <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
              {state.fieldErrors.twitterHandle}
            </p>
          ) : null}
        </div>

        <SubmitButton size="lg" pendingLabel="Saving…" className="w-full sm:w-auto">
          Save profile
        </SubmitButton>

        {state.message && !state.ok ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {state.message}
          </p>
        ) : null}
      </form>

      <form action={skipProfileSetup} className="mt-8 border-t-2 border-line pt-6">
        <button
          type="submit"
          className="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          Skip for now — browse apps
        </button>
      </form>
    </div>
  );
}
