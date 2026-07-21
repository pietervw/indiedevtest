"use client";

import { useState } from "react";
import { Show } from "@clerk/nextjs";
import Link from "next/link";
import { AuthControls } from "@/components/auth-controls";
import { BrandMark } from "@/components/brand-mark";
import { Container } from "@/components/ui/section";
import { Button } from "@/components/ui/button";

const navLinkClassName =
  "text-sm font-semibold text-ink-muted transition-colors hover:text-ink";

const mobileNavLinkClassName =
  "rounded-lg px-2 py-3 text-base font-semibold text-ink transition-colors hover:bg-paper-muted";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink bg-paper">
      <Container className="flex h-16 items-center justify-between gap-4">
        <BrandMark size="md" />

        {/* Desktop nav */}
        <nav aria-label="Primary" className="hidden items-center gap-4 sm:flex">
          <Link href="/browse" className={navLinkClassName}>
            Browse
          </Link>
          <Show when="signed-in">
            <Link href="/dashboard" className={navLinkClassName}>
              Dashboard
            </Link>
            <Link href="/settings/profile" className={navLinkClassName}>
              Settings
            </Link>
          </Show>
          <Button href="/apps/new" size="sm">
            + Add
          </Button>
          <AuthControls />
        </nav>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="-mr-2 inline-flex size-10 items-center justify-center rounded-lg text-ink transition-colors hover:bg-paper-muted sm:hidden"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </Container>

      {/* Mobile menu */}
      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="border-t-2 border-ink bg-paper sm:hidden"
        >
          <Container className="flex flex-col py-2">
            <Link
              href="/browse"
              onClick={() => setOpen(false)}
              className={mobileNavLinkClassName}
            >
              Browse
            </Link>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className={mobileNavLinkClassName}
              >
                Dashboard
              </Link>
              <Link
                href="/settings/profile"
                onClick={() => setOpen(false)}
                className={mobileNavLinkClassName}
              >
                Settings
              </Link>
            </Show>
            <Button
              href="/apps/new"
              onClick={() => setOpen(false)}
              size="sm"
              className="mt-1 w-full"
            >
              + Add
            </Button>
            <div className="flex items-center gap-5 border-t-2 border-line px-2 py-3">
              <AuthControls />
            </div>
          </Container>
        </nav>
      ) : null}
    </header>
  );
}

function MenuIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
