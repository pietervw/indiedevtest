import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Page not found",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <Section className="bg-grid">
      <Container className="max-w-xl text-center">
        <p className="font-display text-sm font-bold uppercase tracking-wide text-ink-muted">
          404
        </p>
        <h1 className="mt-3 font-display text-4xl font-extrabold text-ink md:text-5xl">
          Page not found
        </h1>
        <p className="mt-4 text-lg text-ink-muted">
          That URL doesn&apos;t exist. Head home and keep shipping.
        </p>
        <div className="mt-8 flex justify-center">
          <Button href="/" size="lg">
            Back home
          </Button>
        </div>
        <p className="mt-6 text-sm text-ink-muted">
          Or{" "}
          <Link
            href="/contact"
            className="font-semibold text-ink underline decoration-brand underline-offset-4"
          >
            contact us
          </Link>
          .
        </p>
      </Container>
    </Section>
  );
}
