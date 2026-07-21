"use client";

import { useActionState } from "react";
import {
  updateTestingContactEmail,
  type ContactEmailState,
} from "@/app/actions/profile";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

const initialState: ContactEmailState = { ok: false, message: "" };
const fieldClassName =
  "w-full rounded-xl border-2 border-ink bg-paper px-4 font-medium text-ink shadow-brutal outline-none transition-shadow focus:shadow-brutal-brand-lg disabled:opacity-50";

export function TestingContactEmailForm({
  currentEmail,
  verifiedEmails,
}: {
  currentEmail: string | null;
  verifiedEmails: string[];
}) {
  const [state, formAction] = useActionState(updateTestingContactEmail, initialState);
  const defaultValue = verifiedEmails.includes(currentEmail ?? "")
    ? currentEmail!
    : verifiedEmails[0] ?? "";

  return (
    <form action={formAction} className="mt-8 flex max-w-xl flex-col gap-4">
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
      <SubmitButton
        size="lg"
        pendingLabel="Saving…"
        disabled={verifiedEmails.length === 0}
        className="w-full sm:w-auto"
      >
        Save testing email
      </SubmitButton>
      {state.message ? (
        <p className={cn("text-sm font-semibold", state.ok ? "text-ink" : "text-red-600")} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
