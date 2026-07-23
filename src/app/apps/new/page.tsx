import { AppListingForm } from "@/components/app-listing-form";
import { Container } from "@/components/ui/section";
import { requireDbUser } from "@/lib/auth-guards";
import { canonicalMetadata } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  ...canonicalMetadata("/apps/new"),
  title: "Add app",
  robots: { index: false, follow: false },
};

export default async function NewAppPage() {
  await requireDbUser();

  return (
    <div className="relative flex-1 overflow-hidden bg-grid">
      <div className="pointer-events-none absolute -right-16 top-8 size-56 rounded-full bg-brand/20" />
      <Container className="relative py-14 md:py-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Step 1 of 2
        </p>
        <h1 className="mt-2 max-w-xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
          List an app
        </h1>
        <p className="mt-4 max-w-lg text-lg text-ink-muted">
          Open it for testing and get in front of fellow indie developers. Next
          you can add screenshots.
        </p>
        <div className="mt-10">
          <AppListingForm submitLabel="Continue to screenshots" />
        </div>
      </Container>
    </div>
  );
}
