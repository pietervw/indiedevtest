"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type GalleryImage = {
  id: string;
  publicUrl: string;
  width: number;
  height: number;
  alt: string;
};

function Thumbnail({
  image,
  index,
  onOpen,
}: {
  image: GalleryImage;
  index: number;
  onOpen: (index: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className="group relative aspect-[9/16] w-28 shrink-0 overflow-hidden rounded-xl border-2 border-ink bg-paper-muted shadow-brutal transition-[transform,box-shadow] hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-32"
      aria-label={`View screenshot ${index + 1}: ${image.alt}`}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-paper-muted via-line/40 to-paper-muted transition-opacity",
          loaded ? "opacity-0" : "animate-pulse opacity-100"
        )}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- public R2 CDN; skip Next optimizer to avoid origin load */}
      <img
        src={image.publicUrl}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading="lazy"
        decoding="async"
        className={cn(
          "relative size-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
      />
    </button>
  );
}

function LightboxImage({ image }: { image: GalleryImage }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative max-h-[80vh] overflow-hidden rounded-2xl border-2 border-paper bg-paper-muted shadow-brutal-lg">
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-paper-muted via-line/50 to-paper-muted",
          loaded ? "opacity-0" : "animate-pulse opacity-100"
        )}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.publicUrl}
        alt={image.alt}
        width={image.width}
        height={image.height}
        className={cn(
          "max-h-[80vh] w-auto max-w-full object-contain transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

function Lightbox({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: GalleryImage[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const image = images[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onPrev, onNext]);

  if (!image) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot gallery"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-lg border-2 border-paper bg-ink px-3 py-1.5 font-display text-sm font-bold text-paper"
      >
        Close
      </button>

      {images.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous screenshot"
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-lg border-2 border-paper bg-ink px-3 py-3 font-display text-lg font-bold text-paper sm:left-6"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next screenshot"
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-lg border-2 border-paper bg-ink px-3 py-3 font-display text-lg font-bold text-paper sm:right-6"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
          >
            →
          </button>
        </>
      ) : null}

      <div
        className="relative flex max-h-[90vh] max-w-[min(100%,56rem)] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <LightboxImage key={image.id} image={image} />
        <p className="mt-3 font-display text-sm font-bold text-paper">
          {index + 1} / {images.length}
        </p>
      </div>
    </div>
  );
}

/** Public listing screenshot strip + lightbox. Images load from R2 CDN. */
export function ListingScreenshotGallery({
  images,
  className,
  title = "Screenshots",
  hideTitle = false,
}: {
  images: GalleryImage[];
  className?: string;
  title?: string;
  hideTitle?: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const prev = useCallback(() => {
    setOpenIndex((i) =>
      i === null ? null : (i - 1 + images.length) % images.length
    );
  }, [images.length]);
  const next = useCallback(() => {
    setOpenIndex((i) => (i === null ? null : (i + 1) % images.length));
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <section
      className={cn(hideTitle ? undefined : "mt-10", className)}
      aria-label={title}
    >
      {hideTitle ? null : (
        <h2 className="font-display text-xl font-extrabold text-ink">{title}</h2>
      )}
      <div className={cn("flex gap-3 overflow-x-auto pb-2", hideTitle ? undefined : "mt-4")}>
        {images.map((image, index) => (
          <Thumbnail
            key={image.id}
            image={image}
            index={index}
            onOpen={setOpenIndex}
          />
        ))}
      </div>
      {openIndex !== null ? (
        <Lightbox
          images={images}
          index={openIndex}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      ) : null}
    </section>
  );
}
