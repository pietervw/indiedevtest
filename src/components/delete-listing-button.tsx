"use client";

import { useRef, useTransition } from "react";
import { deleteAppListing } from "@/app/actions/listings";
import { Button } from "@/components/ui/button";

export function DeleteListingButton({ listingId }: { listingId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        size="md"
        variant="ghost"
        className="border-red-600 text-red-700 hover:border-red-700 hover:bg-red-50 hover:text-red-800"
        onClick={() => dialogRef.current?.showModal()}
      >
        Delete listing
      </Button>

      <dialog
        ref={dialogRef}
        className="m-auto max-w-md rounded-2xl border-2 border-ink bg-paper p-0 shadow-brutal open:flex open:flex-col backdrop:bg-ink/40"
      >
        <form method="dialog" className="flex flex-col gap-4 p-6">
          <h2 className="font-display text-xl font-extrabold text-ink">
            Delete this listing?
          </h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            Deleting this listing will:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Cancel all ongoing tests</li>
            <li>
              Remove testers&apos; Completed credit (they keep Joined credit)
            </li>
            <li>Expire all pending tester requests</li>
            <li>Remove reviews on this listing</li>
          </ul>
          <p className="text-sm font-semibold text-ink">
            This action cannot be undone.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Button
              type="submit"
              size="md"
              variant="secondary"
              value="cancel"
              disabled={pending}
            >
              Keep listing
            </Button>
            <Button
              type="button"
              size="md"
              variant="dark"
              className="bg-red-700 hover:bg-red-800"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await deleteAppListing(listingId);
                });
              }}
            >
              {pending ? "Deleting…" : "Delete listing"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
