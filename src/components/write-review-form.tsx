"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createReview, type ReviewState } from "@/app/actions/reviews";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

const initialState: ReviewState = { ok: false, message: "" };

const textareaClassName =
  "min-h-28 w-full rounded-xl border-2 border-ink bg-paper px-4 py-3 font-medium text-ink shadow-brutal outline-none transition-shadow placeholder:text-ink-muted focus:shadow-brutal-brand-lg disabled:opacity-50";

export function WriteReviewForm({ listingId }: { listingId: string }) {
  const router = useRouter();
  const action = createReview.bind(null, listingId);
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  if (state.ok) {
    return (
      <p className="font-display text-lg font-bold text-ink" role="status">
        {state.message}
      </p>
    );
  }

  return (
    <div className="max-w-xl">
      <h3 className="font-display text-lg font-extrabold text-ink">
        Write a review
      </h3>
      <p className="mt-1 text-sm text-ink-muted">
        Share what worked and what didn&apos;t — no star ratings, just useful
        feedback for the developer.
      </p>
      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <label className="sr-only" htmlFor="review-content">
          Review
        </label>
        <textarea
          id="review-content"
          name="content"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder="What should other indie devs know about testing this app?"
          className={cn(
            textareaClassName,
            state.fieldErrors?.content ? "border-red-600" : ""
          )}
          aria-invalid={Boolean(state.fieldErrors?.content)}
        />
        {state.fieldErrors?.content ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {state.fieldErrors.content}
          </p>
        ) : null}
        <SubmitButton size="md" pendingLabel="Publishing…" className="w-full sm:w-auto">
          Publish review
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
