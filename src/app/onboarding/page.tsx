import { OnboardingForm } from "@/components/onboarding-form";
import { Container } from "@/components/ui/section";
import { requireOnboardingPending } from "@/lib/auth-guards";
import { canonicalMetadata } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  ...canonicalMetadata("/onboarding"),
  title: "Welcome",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  await requireOnboardingPending();

  return (
    <div className="relative flex-1 overflow-hidden bg-grid">
      <div className="pointer-events-none absolute -left-20 top-10 size-64 rounded-full bg-brand/25" />
      <Container className="relative py-14 md:py-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Step 1 of 2
        </p>
        <h1 className="mt-2 max-w-xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
          Welcome. List your first app?
        </h1>
        <p className="mt-4 max-w-lg text-lg text-ink-muted">
          Get it in front of fellow indie testers — or skip and help someone else
          clear their Play Store wall first. Next you&apos;ll set up your
          profile.
        </p>
        <div className="mt-10">
          <OnboardingForm />
        </div>
      </Container>
    </div>
  );
}
