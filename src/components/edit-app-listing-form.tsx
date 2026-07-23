"use client";

import { useActionState, useState } from "react";
import {
  updateAppListing,
  type UpdateListingState,
} from "@/app/actions/listings";
import { DeleteListingButton } from "@/components/delete-listing-button";
import { SubmitButton } from "@/components/submit-button";
import { statusOptionsFor } from "@/lib/listing-status";
import { umamiEvent } from "@/lib/umami";
import { cn } from "@/lib/utils";
import type { AppListingStatus } from "@/generated/prisma";

const initialState: UpdateListingState = { ok: false, message: "" };

const fieldClassName =
  "w-full rounded-xl border-2 border-ink bg-paper px-4 font-medium text-ink shadow-brutal outline-none transition-shadow placeholder:text-ink-muted focus:shadow-brutal-brand-lg disabled:opacity-50";

const labelClassName = "mb-1.5 block text-sm font-semibold text-ink";

export type EditListingDefaults = {
  name: string;
  description: string;
  category: string;
  platform: string;
  logoUrl: string;
  testingAccessUrl: string;
  testerInstructions: string;
  testerCapacity: number | null;
  status: AppListingStatus;
  storeLink: string;
  showTesterFeedback: boolean;
};

export function EditAppListingForm({
  listingId,
  defaults,
  className,
}: {
  listingId: string;
  defaults: EditListingDefaults;
  className?: string;
}) {
  const action = updateAppListing.bind(null, listingId);
  const [state, formAction] = useActionState(action, initialState);
  const [status, setStatus] = useState<AppListingStatus>(defaults.status);
  const statusOptions = statusOptionsFor(defaults.status);

  return (
    <>
    <form action={formAction} className={cn("flex w-full max-w-xl flex-col gap-5", className)}>
      <div>
        <label htmlFor="edit-app-name" className={labelClassName}>
          App name
        </label>
        <input
          id="edit-app-name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          defaultValue={defaults.name}
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
        <label htmlFor="edit-app-description" className={labelClassName}>
          Short description
        </label>
        <textarea
          id="edit-app-description"
          name="description"
          required
          minLength={20}
          maxLength={2000}
          rows={4}
          defaultValue={defaults.description}
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
          <label htmlFor="edit-app-category" className={labelClassName}>
            Category
          </label>
          <select
            id="edit-app-category"
            name="category"
            required
            defaultValue={defaults.category}
            className={cn(fieldClassName, "h-12")}
            aria-invalid={Boolean(state.fieldErrors?.category)}
          >
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
          <label htmlFor="edit-app-platform" className={labelClassName}>
            Platform
          </label>
          <select
            id="edit-app-platform"
            name="platform"
            required
            defaultValue={defaults.platform}
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
        <label htmlFor="edit-app-logo" className={labelClassName}>
          Logo URL <span className="font-medium text-ink-muted">(optional)</span>
        </label>
        <input
          id="edit-app-logo"
          name="logoUrl"
          type="url"
          maxLength={500}
          defaultValue={defaults.logoUrl}
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

      <fieldset className="rounded-2xl border-2 border-ink bg-paper-muted p-5">
        <legend className="px-1 font-display text-lg font-extrabold text-ink">
          Private tester invitation
        </legend>
        <p className="mt-1 text-sm text-ink-muted">
          Sent only to testers after you accept their request. It is never shown
          on the public listing.
        </p>
        <div className="mt-5">
          <label htmlFor="edit-app-testing-link" className={labelClassName}>
            Testing access link <span className="font-medium text-ink-muted">(optional)</span>
          </label>
          <input
            id="edit-app-testing-link"
            name="testingAccessUrl"
            type="url"
            maxLength={500}
            defaultValue={defaults.testingAccessUrl}
            placeholder="https://play.google.com/apps/testing/…"
            className={cn(fieldClassName, "h-12")}
            aria-invalid={Boolean(state.fieldErrors?.testingAccessUrl)}
          />
          {state.fieldErrors?.testingAccessUrl ? (
            <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
              {state.fieldErrors.testingAccessUrl}
            </p>
          ) : null}
        </div>
        <div className="mt-5">
          <label htmlFor="edit-app-tester-instructions" className={labelClassName}>
            Tester instructions <span className="font-medium text-ink-muted">(optional)</span>
          </label>
          <textarea
            id="edit-app-tester-instructions"
            name="testerInstructions"
            maxLength={2000}
            rows={5}
            defaultValue={defaults.testerInstructions}
            placeholder="For example: I’ll add your email to the Google Group today. Open the link once you receive access, install the app, and keep it installed for 14 days."
            className={cn(fieldClassName, "resize-y py-3")}
            aria-invalid={Boolean(state.fieldErrors?.testerInstructions)}
          />
          {state.fieldErrors?.testerInstructions ? (
            <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
              {state.fieldErrors.testerInstructions}
            </p>
          ) : null}
        </div>
      </fieldset>

      <div>
        <label htmlFor="edit-app-tester-capacity" className={labelClassName}>
          Testers needed <span className="font-medium text-ink-muted">(optional)</span>
        </label>
        <input
          id="edit-app-tester-capacity"
          name="testerCapacity"
          type="number"
          min={1}
          max={10000}
          inputMode="numeric"
          defaultValue={defaults.testerCapacity ?? ""}
          placeholder="For example: 10"
          className={cn(fieldClassName, "h-12")}
          aria-invalid={Boolean(state.fieldErrors?.testerCapacity)}
        />
        <p className="mt-1 text-sm text-ink-muted">
          Accepted testers fill this capacity. Clear it to remove the limit.
        </p>
        {state.fieldErrors?.testerCapacity ? (
          <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
            {state.fieldErrors.testerCapacity}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="edit-app-status" className={labelClassName}>
          Status
        </label>
        <select
          id="edit-app-status"
          name="status"
          required
          value={status}
          onChange={(e) => setStatus(e.target.value as AppListingStatus)}
          className={cn(fieldClassName, "h-12")}
          aria-invalid={Boolean(state.fieldErrors?.status)}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-sm text-ink-muted">
          Flow: Draft → Open for testing → Closed (optional) → Testing complete →
          Launched
        </p>
        {state.fieldErrors?.status ? (
          <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
            {state.fieldErrors.status}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="edit-app-store" className={labelClassName}>
          Store link{" "}
          {status === "launched" ? (
            <span className="font-medium text-ink">(required for Launched)</span>
          ) : (
            <span className="font-medium text-ink-muted">(optional)</span>
          )}
        </label>
        <input
          id="edit-app-store"
          name="storeLink"
          type="url"
          maxLength={500}
          defaultValue={defaults.storeLink}
          placeholder="https://play.google.com/store/apps/…"
          required={status === "launched"}
          className={cn(fieldClassName, "h-12")}
          aria-invalid={Boolean(state.fieldErrors?.storeLink)}
        />
        {state.fieldErrors?.storeLink ? (
          <p className="mt-1 text-sm font-semibold text-red-600" role="alert">
            {state.fieldErrors.storeLink}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border-2 border-line bg-paper-muted/40 px-4 py-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="showTesterFeedback"
            defaultChecked={defaults.showTesterFeedback}
            className="mt-1 size-4 rounded border-2 border-ink"
          />
          <span>
            <span className="block font-display text-sm font-bold text-ink">
              Show tester feedback on listing
            </span>
            <span className="mt-1 block text-sm text-ink-muted">
              When off, feedback stays visible to you and each tester, but is
              hidden from everyone else.
            </span>
          </span>
        </label>
      </div>

      <SubmitButton size="lg" pendingLabel="Saving…" className="w-full sm:w-auto" {...umamiEvent("app_listing_update_click", { status })}>
        Save changes
      </SubmitButton>

      {state.message && !state.ok ? (
        <p className="text-sm font-semibold text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>

    <div className="mt-12 max-w-xl border-t-2 border-line pt-8">
      <h2 className="font-display text-lg font-extrabold text-ink">Danger zone</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Permanently remove this listing and cancel related tests.
      </p>
      <div className="mt-4">
        <DeleteListingButton listingId={listingId} />
      </div>
    </div>
    </>
  );
}
