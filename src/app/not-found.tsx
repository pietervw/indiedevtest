import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Lost in the build",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="relative flex-1 overflow-hidden border-b-2 border-ink bg-grid">
      <div className="pointer-events-none absolute -left-16 top-20 size-48 rounded-full bg-brand/30 blur-2xl" />
      <div className="pointer-events-none absolute -right-10 bottom-10 size-56 rounded-full bg-brand/20 blur-2xl" />

      <Container className="relative flex flex-col items-center py-16 text-center md:py-24">
        <BrandMark size="md" />

        <div
          className="relative mt-12"
          aria-hidden="true"
        >
          {/* Little lost phone */}
          <div className="not-found-float mx-auto w-36 rounded-[1.75rem] border-2 border-ink bg-paper p-2 shadow-brutal-lg">
            <div className="rounded-[1.25rem] border-2 border-ink bg-ink px-3 pb-4 pt-3">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-paper/30" />
              <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-brand/40 bg-brand/15 px-3 py-5">
                <span className="not-found-blink font-display text-4xl font-extrabold leading-none text-brand">
                  ?
                </span>
                <span className="font-display text-[10px] font-bold uppercase tracking-wider text-brand/80">
                  no route
                </span>
              </div>
              <div className="mx-auto mt-3 h-1 w-8 rounded-full bg-paper/40" />
            </div>
          </div>

          {/* Soft shadow puddle */}
          <div className="not-found-shadow mx-auto mt-3 h-3 w-24 rounded-full bg-ink/15" />
        </div>

        <p className="mt-10 font-display text-7xl font-extrabold leading-none text-ink sm:text-8xl">
          4
          <span className="mx-1 inline-block rounded-xl border-2 border-ink bg-brand px-2 text-brand-ink shadow-brutal">
            0
          </span>
          4
        </p>

        <h1 className="mt-6 max-w-md font-display text-2xl font-extrabold text-ink sm:text-3xl">
          This page skipped closed testing
        </h1>
        <p className="mt-3 max-w-sm text-lg text-ink-muted">
          We looked everywhere — under the Play Console, behind TestFlight —
          and still couldn&apos;t find it. Cute, but gone.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button href="/" size="lg">
            Take me home
          </Button>
          <Button href="/browse" size="lg" variant="secondary">
            Browse apps
          </Button>
        </div>

        <p className="mt-8 text-sm text-ink-muted">
          Think this is a bug?{" "}
          <Link
            href="/contact"
            className="font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4"
          >
            Tell us
          </Link>
        </p>
      </Container>
    </div>
  );
}
