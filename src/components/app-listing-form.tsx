"use client";

import { useActionState } from "react";
import {
  createAppListing,
  skipOnboarding,
  type AppListingFormState,
} from "@/app/actions/onboarding";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

const initialState: AppListingFormState = { ok: false, message: "" };

const fieldClassName =
  "w-full rounded-xl border-2 border-ink bg-paper px-4 font-medium text-ink shadow-brutal outline-none transition-shadow placeholder:text-ink-muted focus:shadow-brutal-brand-lg disabled:opacity-50";

const labelClassName = "mb-1.5 block text-sm font-semibold text-ink";

export function AppListingForm({
  className,
  showSkip = false,
  submitLabel = "List my app",
}: {
  className?: string;
  showSkip?: boolean;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(createAppListing, initialState);

  return (
    <div className={cn("w-full max-w-xl", className)}>
      <form action={formAction} className="flex flex-col gap-5">
        <div>
          <label htmlFor="app-name" className={labelClassName}>
            App name
          </label>
          <input
            id="app-name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={80}
            placeholder="TaskMaster Pro"
            className={cn(fieldClassName, "h-12")}
            aria-invalid={Boolean(state.fieldErrors?.name)}
          />
          {state.fieldErrors?.name ? (
            <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
              {state.fieldErrors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="app-description" className={labelClassName}>
            Short description
          </label>
          <textarea
            id="app-description"
            name="description"
            required
            minLength={20}
            maxLength={2000}
            rows={4}
            placeholder="What does it do, and what should testers focus on?"
            className={cn(fieldClassName, "resize-y py-3")}
            aria-invalid={Boolean(state.fieldErrors?.description)}
          />
          {state.fieldErrors?.description ? (
            <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
              {state.fieldErrors.description}
            </p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="app-category" className={labelClassName}>
              Category
            </label>
            <select
              id="app-category"
              name="category"
              required
              defaultValue=""
              className={cn(fieldClassName, "h-12")}
              aria-invalid={Boolean(state.fieldErrors?.category)}
            >
              <option value="" disabled>
                Select…
              </option>
              <option value="game">Game</option>
              <option value="utility">Utility</option>
              <option value="productivity">Productivity</option>
            </select>
            {state.fieldErrors?.category ? (
              <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
                {state.fieldErrors.category}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="app-platform" className={labelClassName}>
              Platform
            </label>
            <select
              id="app-platform"
              name="platform"
              required
              defaultValue="android"
              className={cn(fieldClassName, "h-12")}
              aria-invalid={Boolean(state.fieldErrors?.platform)}
            >
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </select>
            {state.fieldErrors?.platform ? (
              <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
                {state.fieldErrors.platform}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label htmlFor="app-logo" className={labelClassName}>
            Logo URL <span className="font-medium text-ink-muted">(optional)</span>
          </label>
          <input
            id="app-logo"
            name="logoUrl"
            type="url"
            maxLength={500}
            placeholder="https://…"
            className={cn(fieldClassName, "h-12")}
            aria-invalid={Boolean(state.fieldErrors?.logoUrl)}
          />
          {state.fieldErrors?.logoUrl ? (
            <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
              {state.fieldErrors.logoUrl}
            </p>
          ) : null}
        </div>

        <SubmitButton size="lg" pendingLabel="Listing…" className="w-full sm:w-auto">
          {submitLabel}
        </SubmitButton>

        {state.message && !state.ok ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {state.message}
          </p>
        ) : null}
      </form>

      {showSkip ? (
        <form action={skipOnboarding} className="mt-8 border-t-2 border-line pt-6">
          <p className="text-sm text-ink-muted">
            Not ready to list an app? Jump in as a tester first.
          </p>
          <button
            type="submit"
            className="mt-3 cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Skip — browse apps that need testers
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** @deprecated use AppListingForm */
export function OnboardingForm(props: { className?: string }) {
  return <AppListingForm {...props} showSkip />;
}
