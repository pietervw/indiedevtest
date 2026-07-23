"use client";

import { useCallback, useState, useTransition } from "react";
import {
  cancelListingScreenshotUploads,
  confirmListingScreenshots,
  createListingScreenshotUploadSlots,
  deleteListingScreenshot,
  finishListingScreenshotsStep,
  reorderListingScreenshots,
  type ListingScreenshotDto,
} from "@/app/actions/screenshots";
import {
  ImageUploadManager,
  type ImageUploadActions,
} from "@/components/image-upload-manager";
import { Button } from "@/components/ui/button";
import { LISTING_IMAGE_LIMITS } from "@/lib/storage/image-limits";
import { cn } from "@/lib/utils";

export function ScreenshotManager({
  listingId,
  initialScreenshots,
  mode = "edit",
  className,
}: {
  listingId: string;
  initialScreenshots: ListingScreenshotDto[];
  /** create = post-listing step with Skip / Continue; edit = manage only */
  mode?: "create" | "edit";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const onBusyChange = useCallback((busy: boolean) => {
    setUploading(busy);
  }, []);

  const actions: ImageUploadActions = {
    createSlots: (slots) => createListingScreenshotUploadSlots(listingId, slots),
    confirm: (items) => confirmListingScreenshots(listingId, items),
    cancel: (objectKeys) =>
      cancelListingScreenshotUploads(listingId, objectKeys),
    reorder: (orderedIds) => reorderListingScreenshots(listingId, orderedIds),
    delete: (screenshotId) => deleteListingScreenshot(listingId, screenshotId),
  };

  const navigationBlocked = pending || uploading;

  return (
    <div className={cn("w-full max-w-xl", className)}>
      {mode === "create" ? (
        <div className="mb-6 rounded-2xl border-2 border-ink bg-brand/15 px-4 py-3 text-sm font-medium text-ink">
          Screenshots are optional but recommended — listings with photos get
          more tester interest.
        </div>
      ) : null}

      <ImageUploadManager
        initialScreenshots={initialScreenshots}
        limits={LISTING_IMAGE_LIMITS}
        actions={actions}
        emptyHint="No screenshots yet — you can add them later when editing the listing."
        onBusyChange={onBusyChange}
      />

      {mode === "create" ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="primary"
            disabled={navigationBlocked}
            onClick={() => {
              startTransition(async () => {
                await finishListingScreenshotsStep(listingId);
              });
            }}
          >
            Continue
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={navigationBlocked}
            onClick={() => {
              startTransition(async () => {
                await finishListingScreenshotsStep(listingId);
              });
            }}
          >
            Skip for now
          </Button>
        </div>
      ) : null}
    </div>
  );
}
