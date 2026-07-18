"use client";

import { Show } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Client-only so /browse RSC can stay free of Clerk auth(). */
export function BrowseAddButton() {
  return (
    <Show when="signed-in">
      <Button href="/apps/new" size="sm" className="shrink-0 self-start sm:self-auto">
        + Add
      </Button>
    </Show>
  );
}

/** Empty-state CTA that differs for signed-in vs signed-out visitors. */
export function BrowseEmptyCta() {
  return (
    <p className="max-w-lg text-lg text-ink-muted">
      No open listings yet.{" "}
      <Show when="signed-in">
        <Link href="/apps/new" className="font-semibold text-ink underline">
          List your app
        </Link>{" "}
        to get started.
      </Show>
      <Show when="signed-out">
        Sign in to list an app or check back soon.
      </Show>
    </p>
  );
}
