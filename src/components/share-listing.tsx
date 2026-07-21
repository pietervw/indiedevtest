"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type ShareListingProps = {
  appName: string;
  category: string;
  url: string;
};

/**
 * Lightweight, no-account sharing for the viral loop in the product spec.
 * The native share sheet is preferred on supported mobile browsers; copying
 * the canonical URL remains a dependable fallback everywhere else.
 */
export function ShareListing({ appName, category, url }: ShareListingProps) {
  const [message, setMessage] = useState<string | null>(null);
  const text = `Need testers for ${appName} — help me launch this ${category} app!`;
  const xIntent = `https://x.com/intent/tweet?text=${encodeURIComponent(
    text
  )}&url=${encodeURIComponent(url)}`;

  async function share() {
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: appName, text, url });
          setMessage("Thanks for sharing.");
          return;
        } catch (error) {
          // User dismissed the sheet — not a failure. Other share errors fall
          // through to clipboard so sharing still degrades to copy-link.
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
        }
      }

      await navigator.clipboard.writeText(url);
      setMessage("Link copied.");
    } catch {
      setMessage("Couldn’t share the link. Try the X button instead.");
    }
  }

  return (
    <section className="mt-10 max-w-2xl rounded-2xl border-2 border-ink bg-paper p-5 shadow-brutal">
      <h2 className="font-display text-xl font-extrabold text-ink">
        Help fill the tester slots
      </h2>
      <p className="mt-1 text-ink-muted">
        Share this listing with indie developers who can test it.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={share} size="sm">
          Share listing
        </Button>
        <Button
          href={xIntent}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          size="sm"
        >
          Share on X
        </Button>
        {message ? (
          <p className="text-sm font-semibold text-ink-muted" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
