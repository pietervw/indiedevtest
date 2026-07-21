"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateProfileSettings,
  type ProfileSettingsState,
} from "@/app/actions/profile";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

const initialState: ProfileSettingsState = { ok: false, message: "" };
const fieldClassName =
  "w-full rounded-xl border-2 border-ink bg-paper px-4 font-medium text-ink shadow-brutal outline-none transition-shadow focus:shadow-brutal-brand-lg disabled:opacity-50";

export function ProfileSettingsForm({
  currentEmail,
  verifiedEmails,
  bio,
  twitterHandle,
  trustMrrProfileUrl,
}: {
  currentEmail: string | null;
  verifiedEmails: string[];
  bio: string | null;
  twitterHandle: string | null;
  trustMrrProfileUrl: string | null;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateProfileSettings, initialState);
  const defaultValue = verifiedEmails.includes(currentEmail ?? "")
    ? currentEmail!
    : verifiedEmails[0] ?? "";

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  return (
    <form action={formAction} className="mt-8 flex max-w-xl flex-col gap-5">
      <div>
        <label htmlFor="settings-contact-email" className="mb-1.5 block text-sm font-semibold text-ink">
          Testing contact email
        </label>
        <select
          id="settings-contact-email"
          name="contactEmail"
          defaultValue={defaultValue}
          disabled={verifiedEmails.length === 0}
          className={cn(fieldClassName, "h-12")}
          aria-invalid={Boolean(state.fieldErrors?.contactEmail)}
        >
          {verifiedEmails.length === 0 ? (
            <option value="">No verified email addresses found</option>
          ) : (
            verifiedEmails.map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            ))
          )}
        </select>
        <p className="mt-2 text-sm text-ink-muted">
          This address is shared only with developers whose apps you request to
          test, and testers you accept for your own apps. Existing requests keep
          the email that was shared when they were created.
        </p>
        {verifiedEmails.length === 0 ? (
          <p className="mt-2 text-sm font-semibold text-red-600" role="alert">
            Add and verify an email address in the Clerk account menu, then
            refresh this page.
          </p>
        ) : null}
        {state.fieldErrors?.contactEmail ? (
          <p className="mt-2 text-sm font-semibold text-red-600" role="alert">
            {state.fieldErrors.contactEmail}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="settings-bio" className="mb-1.5 block text-sm font-semibold text-ink">
          Short bio <span className="font-medium text-ink-muted">(optional)</span>
        </label>
        <textarea id="settings-bio" name="bio" defaultValue={bio ?? ""} maxLength={280} rows={3} className={cn(fieldClassName, "resize-y py-3")} aria-invalid={Boolean(state.fieldErrors?.bio)} />
        <p className="mt-1 text-sm text-ink-muted">Shown on your public profile. Max 280 characters.</p>
        {state.fieldErrors?.bio ? <p className="mt-1 text-sm font-semibold text-red-600" role="alert">{state.fieldErrors.bio}</p> : null}
      </div>
      <div>
        <label htmlFor="settings-twitter" className="mb-1.5 block text-sm font-semibold text-ink">
          X / Twitter handle <span className="font-medium text-ink-muted">(optional)</span>
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-ink-muted">@</span>
          <input id="settings-twitter" name="twitterHandle" type="text" defaultValue={twitterHandle ?? ""} maxLength={15} autoComplete="off" spellCheck={false} className={cn(fieldClassName, "h-12 pl-8")} aria-invalid={Boolean(state.fieldErrors?.twitterHandle)} />
        </div>
        {state.fieldErrors?.twitterHandle ? <p className="mt-1 text-sm font-semibold text-red-600" role="alert">{state.fieldErrors.twitterHandle}</p> : null}
      </div>
      <div>
        <label htmlFor="settings-trustmrr" className="mb-1.5 block text-sm font-semibold text-ink">
          TrustMRR founder profile <span className="font-medium text-ink-muted">(optional)</span>
        </label>
        <input id="settings-trustmrr" name="trustMrrProfileUrl" type="url" defaultValue={trustMrrProfileUrl ?? ""} placeholder="https://trustmrr.com/founder/your-name" className={cn(fieldClassName, "h-12")} aria-invalid={Boolean(state.fieldErrors?.trustMrrProfileUrl)} />
        <p className="mt-1 text-sm text-ink-muted">
          Displayed on your public profile. Learn more about{" "}
          <a href="https://trustmrr.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline">TrustMRR ↗</a>
        </p>
        {state.fieldErrors?.trustMrrProfileUrl ? <p className="mt-1 text-sm font-semibold text-red-600" role="alert">{state.fieldErrors.trustMrrProfileUrl}</p> : null}
      </div>
      <SubmitButton
        size="lg"
        pendingLabel="Saving…"
        disabled={verifiedEmails.length === 0}
        className="w-full sm:w-auto"
      >
        Save profile settings
      </SubmitButton>
      {state.message ? (
        <p className={cn("text-sm font-semibold", state.ok ? "text-ink" : "text-red-600")} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
