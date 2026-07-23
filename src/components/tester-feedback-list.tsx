"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { ListingScreenshotGallery } from "@/components/listing-screenshot-gallery";
import type { PublicListingFeedback } from "@/lib/public-listing";
import { profilePath } from "@/lib/mock-data";

function LocalTimestamp({ iso }: { iso: string }) {
  const label = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso)),
    [iso]
  );

  return (
    <time dateTime={iso} className="text-sm text-ink-muted">
      {label}
    </time>
  );
}

export function TesterFeedbackList({
  feedback,
}: {
  feedback: PublicListingFeedback[];
}) {
  if (feedback.length === 0) {
    return <p className="mt-3 text-ink-muted">No tester feedback yet.</p>;
  }

  return (
    <ul className="mt-6 space-y-6">
      {feedback.map((item) => {
        const profileHref = profilePath(item.tester.profileSlug);
        const images = item.screenshots.map((shot, index) => ({
          id: shot.id,
          publicUrl: shot.publicUrl,
          width: shot.width,
          height: shot.height,
          alt: `${item.tester.displayName} evidence ${index + 1}`,
        }));

        return (
          <li
            key={item.id}
            className="overflow-hidden rounded-2xl border-2 border-ink bg-paper px-5 py-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href={profileHref}
                className="inline-flex items-center gap-2 font-semibold text-ink hover:underline"
              >
                {item.tester.imageUrl ? (
                  <Image
                    src={item.tester.imageUrl}
                    alt=""
                    width={36}
                    height={36}
                    className="size-9 rounded-full border-2 border-ink object-cover"
                  />
                ) : (
                  <span className="flex size-9 items-center justify-center rounded-full border-2 border-ink bg-paper-muted text-sm font-bold">
                    {item.tester.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                {item.tester.displayName}
              </Link>
              <LocalTimestamp iso={item.updatedAt || item.createdAt} />
            </div>
            <p className="mt-4 text-ink">
              <span className="font-display text-sm font-bold text-ink-muted">
                Needs improvement:{" "}
              </span>
              {item.improvementSuggestion}
            </p>
            <ListingScreenshotGallery
              images={images}
              title="Evidence screenshots"
              hideTitle
              className="mt-5"
            />
          </li>
        );
      })}
    </ul>
  );
}
