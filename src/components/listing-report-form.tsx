"use client";

import { useActionState } from "react";
import {
  createListingReport,
  type ListingReportState,
} from "@/app/actions/listing-reports";
import { SubmitButton } from "@/components/submit-button";
import { listingReportReasonLabels } from "@/lib/listing-reports";
import { umamiEvent } from "@/lib/umami";

const initialState: ListingReportState = { ok: false, message: "" };

export function ListingReportForm({ listingId }: { listingId: string }) {
  const action = createListingReport.bind(null, listingId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <details className="mt-10 max-w-2xl rounded-xl border-2 border-line bg-paper-muted p-4">
      <summary className="cursor-pointer font-semibold text-ink">Report this app</summary>
      <p className="mt-2 text-sm text-ink-muted">
        Reports are private. The app owner will not see who reported their listing.
      </p>
      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <label className="text-sm font-bold text-ink" htmlFor={`report-reason-${listingId}`}>
          Why are you reporting it?
        </label>
        <select
          id={`report-reason-${listingId}`}
          name="reason"
          defaultValue=""
          required
          className="h-11 rounded-lg border-2 border-ink bg-paper px-3 text-sm"
        >
          <option value="" disabled>Select a reason</option>
          {Object.entries(listingReportReasonLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <label className="text-sm font-bold text-ink" htmlFor={`report-details-${listingId}`}>
          Details <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <textarea
          id={`report-details-${listingId}`}
          name="details"
          maxLength={1000}
          rows={3}
          className="rounded-lg border-2 border-ink bg-paper p-3 text-sm"
          placeholder="What should we know?"
        />
        <div><SubmitButton size="sm" variant="secondary" pendingLabel="Sending…" {...umamiEvent("listing_report_send_click")}>Send report</SubmitButton></div>
        {state.message ? (
          <p className={state.ok ? "text-sm font-semibold text-ink" : "text-sm font-semibold text-red-600"} role={state.ok ? "status" : "alert"}>
            {state.message}
          </p>
        ) : null}
      </form>
    </details>
  );
}
