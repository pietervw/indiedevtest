"use client";

import { useId, useRef, useState, useTransition } from "react";
import {
  cancelListingScreenshotUploads,
  confirmListingScreenshots,
  createListingScreenshotUploadSlots,
  deleteListingScreenshot,
  finishListingScreenshotsStep,
  reorderListingScreenshots,
  type ListingScreenshotDto,
} from "@/app/actions/screenshots";
import { Button } from "@/components/ui/button";
import {
  IMAGE_LIMITS,
  OBJECT_CACHE_CONTROL,
  isAllowedImageContentType,
  validateImageByteSize,
  validateImageDimensions,
} from "@/lib/storage/image-limits";
import { cn } from "@/lib/utils";

function readImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    img.src = url;
  });
}

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
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [shots, setShots] =
    useState<ListingScreenshotDto[]>(initialScreenshots);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const remaining = IMAGE_LIMITS.maxFiles - shots.length;
  const atLimit = remaining <= 0;

  async function processFiles(fileList: FileList | File[]) {
    setError(null);
    const files = Array.from(fileList);
    if (files.length === 0) return;

    if (files.length > remaining) {
      setError(
        `You can add at most ${IMAGE_LIMITS.maxFiles} screenshots (${remaining} remaining).`
      );
      return;
    }

    const prepared: {
      file: File;
      contentType: string;
      byteSize: number;
      width: number;
      height: number;
    }[] = [];

    for (const file of files) {
      const contentType = file.type;
      if (!isAllowedImageContentType(contentType)) {
        setError("Only JPEG, PNG, and WebP images are allowed.");
        return;
      }
      const sizeError = validateImageByteSize(file.size);
      if (sizeError) {
        setError(sizeError);
        return;
      }
      let dims: { width: number; height: number };
      try {
        dims = await readImageDimensions(file);
      } catch {
        setError("Could not read one of the images.");
        return;
      }
      const dimError = validateImageDimensions(dims.width, dims.height);
      if (dimError) {
        setError(dimError);
        return;
      }
      prepared.push({
        file,
        contentType,
        byteSize: file.size,
        width: dims.width,
        height: dims.height,
      });
    }

    setBusy(true);
    let mintedKeys: string[] = [];
    try {
      const slotsResult = await createListingScreenshotUploadSlots(
        listingId,
        prepared.map((p) => ({
          contentType: p.contentType,
          byteSize: p.byteSize,
          width: p.width,
          height: p.height,
        }))
      );
      if (!slotsResult.ok) {
        setError(slotsResult.message);
        return;
      }

      mintedKeys = slotsResult.slots.map((slot) => slot.objectKey);

      const uploads = await Promise.all(
        slotsResult.slots.map((slot, i) =>
          fetch(slot.uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": slot.contentType,
              "Cache-Control": OBJECT_CACHE_CONTROL,
            },
            body: prepared[i]!.file,
          })
        )
      );
      if (uploads.some((res) => !res.ok)) {
        await cancelListingScreenshotUploads(listingId, mintedKeys);
        setError("Upload to storage failed. Please try again.");
        return;
      }

      const confirmed = await confirmListingScreenshots(
        listingId,
        slotsResult.slots.map((slot) => ({
          objectKey: slot.objectKey,
          contentType: slot.contentType,
          byteSize: slot.byteSize,
          width: slot.width,
          height: slot.height,
        }))
      );

      if (!confirmed.ok) {
        setError(confirmed.message);
        return;
      }

      setShots((prev) => [...prev, ...confirmed.screenshots]);
    } catch (err) {
      console.error(err);
      if (mintedKeys.length > 0) {
        await cancelListingScreenshotUploads(listingId, mintedKeys).catch(
          () => undefined
        );
      }
      setError("Something went wrong uploading screenshots.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (atLimit || busy || pending) return;
    void processFiles(e.dataTransfer.files);
  }

  function onReorderDrop(toIndex: number) {
    if (dragIndex === null || dragIndex === toIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...shots];
    const [moved] = next.splice(dragIndex, 1);
    if (!moved) {
      setDragIndex(null);
      return;
    }
    next.splice(toIndex, 0, moved);
    setDragIndex(null);
    const previous = shots;
    setShots(next);

    startTransition(async () => {
      const result = await reorderListingScreenshots(
        listingId,
        next.map((s) => s.id)
      );
      if (!result.ok) {
        setError(result.message);
        setShots(previous);
      }
    });
  }

  function onDelete(id: string) {
    setError(null);
    const previous = shots;
    setShots((prev) => prev.filter((s) => s.id !== id));
    startTransition(async () => {
      const result = await deleteListingScreenshot(listingId, id);
      if (!result.ok) {
        setError(result.message);
        setShots(previous);
      }
    });
  }

  return (
    <div className={cn("w-full max-w-xl", className)}>
      {mode === "create" ? (
        <div className="mb-6 rounded-2xl border-2 border-ink bg-brand/15 px-4 py-3 text-sm font-medium text-ink">
          Screenshots are optional but recommended — listings with photos get
          more tester interest.
        </div>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!atLimit) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink bg-paper px-6 py-10 text-center shadow-brutal transition-colors",
          dragOver && "bg-brand/20",
          (atLimit || busy || pending) && "opacity-60"
        )}
      >
        <p className="font-display text-lg font-extrabold text-ink">
          Drag & drop screenshots
        </p>
        <p className="mt-2 max-w-sm text-sm text-ink-muted">
          Or click to browse. Up to {IMAGE_LIMITS.maxFiles} images · JPEG, PNG,
          or WebP · max {IMAGE_LIMITS.maxBytes / (1024 * 1024)}MB ·{" "}
          {IMAGE_LIMITS.minWidth}×{IMAGE_LIMITS.minHeight}–
          {IMAGE_LIMITS.maxWidth}×{IMAGE_LIMITS.maxHeight}px
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-5"
          disabled={atLimit || busy || pending}
          onClick={() => inputRef.current?.click()}
        >
          {atLimit ? "Limit reached" : "Browse photos"}
        </Button>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={IMAGE_LIMITS.allowedContentTypes.join(",")}
          multiple
          className="sr-only"
          disabled={atLimit || busy || pending}
          onChange={(e) => {
            if (e.target.files) void processFiles(e.target.files);
          }}
        />
      </div>

      {error ? (
        <p className="mt-3 text-sm font-semibold text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {shots.length > 0 ? (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shots.map((shot, index) => (
            <li
              key={shot.id}
              draggable={!busy && !pending}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onReorderDrop(index);
              }}
              className="group relative aspect-[9/16] overflow-hidden rounded-xl border-2 border-ink bg-paper-muted shadow-brutal"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- R2 CDN URLs; avoid Next image proxy load */}
              <img
                src={shot.publicUrl}
                alt=""
                width={shot.width}
                height={shot.height}
                className="size-full object-cover"
                draggable={false}
              />
              <span className="absolute left-2 top-2 rounded-md border-2 border-ink bg-paper px-1.5 py-0.5 text-xs font-bold">
                {index + 1}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onDelete(shot.id)}
                disabled={busy || pending}
                className="absolute right-2 top-2 h-7 px-2 text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label={`Remove screenshot ${index + 1}`}
              >
                Remove
              </Button>
              <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/70 px-2 py-1 text-center text-[10px] font-semibold text-paper opacity-0 transition-opacity group-hover:opacity-100">
                Drag to reorder
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">
          No screenshots yet — you can add them later when editing the listing.
        </p>
      )}

      {mode === "create" ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="primary"
            disabled={busy || pending}
            onClick={() => {
              startTransition(async () => {
                await finishListingScreenshotsStep(listingId);
              });
            }}
          >
            {shots.length > 0 ? "Continue" : "Continue without screenshots"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy || pending}
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

      {(busy || pending) && (
        <p className="mt-3 text-sm font-medium text-ink-muted" aria-live="polite">
          {busy ? "Uploading…" : "Saving…"}
        </p>
      )}
    </div>
  );
}
