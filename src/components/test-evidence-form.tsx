"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelEvidenceScreenshotUploads,
  confirmEvidenceScreenshots,
  createEvidenceScreenshotUploadSlots,
  deleteEvidenceScreenshot,
  getMyTestEvidence,
  reorderEvidenceScreenshots,
  saveTestEvidence,
  type EvidenceState,
  type TestEvidenceDto,
} from "@/app/actions/test-evidence";
import {
  ImageUploadManager,
  type ImageUploadActions,
  type UploadedImageDto,
} from "@/components/image-upload-manager";
import { SubmitButton } from "@/components/submit-button";
import {
  EVIDENCE_IMAGE_LIMITS,
} from "@/lib/storage/image-limits";
import {
  MAX_IMPROVEMENT_LENGTH,
  MIN_IMPROVEMENT_LENGTH,
} from "@/lib/test-evidence";
import { cn } from "@/lib/utils";

const initialState: EvidenceState = { ok: false, message: "" };

const textareaClassName =
  "min-h-24 w-full rounded-xl border-2 border-ink bg-paper px-4 py-3 font-medium text-ink shadow-brutal outline-none transition-shadow placeholder:text-ink-muted focus:shadow-brutal-brand-lg disabled:opacity-50";

export function TestEvidenceForm({
  listingId,
  initialEvidence,
}: {
  listingId: string;
  initialEvidence?: TestEvidenceDto | null;
}) {
  const router = useRouter();
  const action = saveTestEvidence.bind(null, listingId);
  const [state, formAction] = useActionState(action, initialState);
  const [shots, setShots] = useState<UploadedImageDto[]>(
    initialEvidence?.screenshots ?? []
  );
  const [suggestion, setSuggestion] = useState(
    initialEvidence?.improvementSuggestion ?? ""
  );
  const [loaded, setLoaded] = useState(Boolean(initialEvidence !== undefined));

  useEffect(() => {
    if (initialEvidence !== undefined) return;
    let cancelled = false;
    void getMyTestEvidence(listingId).then((evidence) => {
      if (cancelled) return;
      if (evidence) {
        setShots(evidence.screenshots);
        setSuggestion(evidence.improvementSuggestion);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [listingId, initialEvidence]);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  const actions: ImageUploadActions = useMemo(
    () => ({
      createSlots: (slots) =>
        createEvidenceScreenshotUploadSlots(listingId, slots),
      confirm: (items) => confirmEvidenceScreenshots(listingId, items),
      cancel: (objectKeys) =>
        cancelEvidenceScreenshotUploads(listingId, objectKeys),
      reorder: (orderedIds) =>
        reorderEvidenceScreenshots(listingId, orderedIds),
      delete: (screenshotId) =>
        deleteEvidenceScreenshot(listingId, screenshotId),
    }),
    [listingId]
  );

  if (!loaded) {
    return (
      <p className="mt-10 text-sm text-ink-muted" aria-live="polite">
        Loading test evidence…
      </p>
    );
  }

  const isEdit = shots.length > 0 || suggestion.trim().length > 0;

  return (
    <div className="mt-10 max-w-xl">
      <h3 className="font-display text-lg font-extrabold text-ink">
        {isEdit ? "Edit your test evidence" : "Submit test evidence"}
      </h3>
      <p className="mt-1 text-sm text-ink-muted">
        Upload at least {EVIDENCE_IMAGE_LIMITS.minFiles} screenshots showing you
        used the app, and one improvement suggestion. The developer needs this
        before they can mark your test complete.
      </p>

      <div className="mt-5">
        <ImageUploadManager
          key={listingId}
          initialScreenshots={shots}
          limits={EVIDENCE_IMAGE_LIMITS}
          actions={actions}
          emptyHint={`Add at least ${EVIDENCE_IMAGE_LIMITS.minFiles} screenshots of you using the app.`}
          onChange={setShots}
        />
      </div>

      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <label
          htmlFor="improvement-suggestion"
          className="font-display text-sm font-bold text-ink"
        >
          One thing that needs improvement
        </label>
        <textarea
          id="improvement-suggestion"
          name="improvementSuggestion"
          required
          minLength={MIN_IMPROVEMENT_LENGTH}
          maxLength={MAX_IMPROVEMENT_LENGTH}
          rows={3}
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          placeholder="What should the developer improve first?"
          className={cn(
            textareaClassName,
            state.fieldErrors?.improvementSuggestion ? "border-red-600" : ""
          )}
          aria-invalid={Boolean(state.fieldErrors?.improvementSuggestion)}
        />
        {state.fieldErrors?.improvementSuggestion ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {state.fieldErrors.improvementSuggestion}
          </p>
        ) : null}
        <p className="text-xs text-ink-muted">
          {suggestion.trim().length}/{MAX_IMPROVEMENT_LENGTH} ·{" "}
          {shots.length}/{EVIDENCE_IMAGE_LIMITS.maxFiles} screenshots
          {shots.length < EVIDENCE_IMAGE_LIMITS.minFiles
            ? ` (${EVIDENCE_IMAGE_LIMITS.minFiles - shots.length} more needed)`
            : ""}
        </p>
        <SubmitButton
          size="md"
          pendingLabel="Saving…"
          className="w-full sm:w-auto"
          disabled={shots.length < EVIDENCE_IMAGE_LIMITS.minFiles}
        >
          {isEdit ? "Update evidence" : "Publish evidence"}
        </SubmitButton>
        {state.message ? (
          <p
            className={cn(
              "text-sm font-semibold",
              state.ok ? "text-ink" : "text-red-600"
            )}
            role={state.ok ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
