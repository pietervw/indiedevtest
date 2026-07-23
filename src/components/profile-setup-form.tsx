"use client";

import { useActionState } from "react";
import {
  completeProfileSetup,
  type ProfileSetupState,
} from "@/app/actions/profile";
import { SubmitButton } from "@/components/submit-button";
import { umamiEvent } from "@/lib/umami";
import { cn } from "@/lib/utils";

const initialState: ProfileSetupState = { ok: false, message: "" };

const fieldClassName =
  "w-full rounded-xl border-2 border-ink bg-paper px-4 font-medium text-ink shadow-brutal outline-none transition-shadow placeholder:text-ink-muted focus:shadow-brutal-brand-lg disabled:opacity-50";

const labelClassName = "mb-1.5 block text-sm font-semibold text-ink";

export function ProfileSetupForm({
  className,
  defaultContactEmail,
  defaultBio = "",
  defaultTwitterHandle = "",
  verifiedContactEmails,
}: {
  className?: string;
  defaultContactEmail: string;
  defaultBio?: string;
  defaultTwitterHandle?: string;
  verifiedContactEmails: string[];
}) {
  const [state, formAction] = useActionState(completeProfileSetup, initialState);

  return (
    <div className={cn("w-full max-w-xl", className)}>
      <form action={formAction} className="flex flex-col gap-5">
        <div>
          <label htmlFor="profile-contact-email" className={labelClassName}>
            Testing contact email
          </label>
          <select
            id="profile-contact-email"
            name="contactEmail"
            required
            defaultValue={defaultContactEmail}
            className={cn(fieldClassName, "h-12")}
            aria-invalid={Boolean(state.fieldErrors?.contactEmail)}
            disabled={verifiedContactEmails.length === 0}
          >
            {verifiedContactEmails.length === 0 ? (
              <option value="">No verified email addresses found</option>
            ) : (
              verifiedContactEmails.map((email) => (
                <option key={email} value={email}>
                  {email}
                </option>
              ))
            )}
          </select>
          <p className="mt-1 text-sm text-ink-muted">
            Shared only with developers whose apps you request to test, and with
            testers you accept for your own app. We never display it publicly.
          </p>
          {verifiedContactEmails.length === 0 ? (
            <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
              Add and verify an email address in the Clerk account menu, then
              refresh this page.
            </p>
          ) : null}
          {state.fieldErrors?.contactEmail ? (
            <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
              {state.fieldErrors.contactEmail}
            </p>
          ) : null}
        </div>

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
            defaultValue={defaultBio}
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
              defaultValue={defaultTwitterHandle}
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

        <SubmitButton
          size="lg"
          pendingLabel="Saving…"
          disabled={verifiedContactEmails.length === 0}
          className="w-full sm:w-auto"
          {...umamiEvent("profile_setup_save_click")}
        >
          Save profile
        </SubmitButton>

        {state.message && !state.ok ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {state.message}
          </p>
        ) : null}
      </form>

    </div>
  );
}
