"use client";

import { useActionState, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { deleteAccount, type DeleteAccountState } from "@/app/actions/account";
import { SubmitButton } from "@/components/submit-button";

const initialState: DeleteAccountState = { ok: false, message: "" };

export function DeleteAccountForm() {
  const { signOut } = useClerk();
  const [state, formAction] = useActionState(deleteAccount, initialState);

  useEffect(() => {
    if (state.ok) void signOut({ redirectUrl: "/" });
  }, [signOut, state.ok]);

  return (
    <section className="mt-12 max-w-xl rounded-2xl border-2 border-red-700 bg-red-50 p-5 shadow-brutal">
      <h2 className="font-display text-xl font-extrabold text-ink">Delete account</h2>
      <p className="mt-2 text-sm text-ink-muted">
        This is permanent and cannot be undone. It deletes your account, public profile, app listings, tester requests, and feedback. Your listings and profile will immediately disappear from IndieDevTest.
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <label htmlFor="delete-account-confirmation" className="block text-sm font-semibold text-ink">
          Type <span className="font-display">DELETE</span> to confirm
        </label>
        <input id="delete-account-confirmation" name="confirmation" required autoComplete="off" className="h-11 w-full rounded-lg border-2 border-ink bg-paper px-3 text-sm" />
        <SubmitButton size="sm" variant="secondary" pendingLabel="Deleting account…">
          Permanently delete my account
        </SubmitButton>
        {state.message ? <p className={state.ok ? "text-sm font-semibold text-ink" : "text-sm font-semibold text-red-700"} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
      </form>
    </section>
  );
}
