import { ProfileSetupForm } from "@/components/profile-setup-form";
import { Container } from "@/components/ui/section";
import { requireProfileSetupPending } from "@/lib/auth-guards";
import { getVerifiedClerkEmails } from "@/lib/verified-clerk-emails";
import { canonicalMetadata } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  ...canonicalMetadata("/onboarding/profile"),
  title: "Your profile",
  robots: { index: false, follow: false },
};

export default async function OnboardingProfilePage() {
  const user = await requireProfileSetupPending();
  const verifiedContactEmails = await getVerifiedClerkEmails();

  return (
    <div className="relative flex-1 overflow-hidden bg-grid">
      <div className="pointer-events-none absolute -right-16 top-8 size-56 rounded-full bg-brand/25" />
      <Container className="relative py-14 md:py-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Step 2 of 2
        </p>
        <h1 className="mt-2 max-w-xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
          Set up your profile
        </h1>
        <p className="mt-4 max-w-lg text-lg text-ink-muted">
          Add the email address you want to share for testing. A short bio and X
          handle help other indie testers know who you are.
        </p>
        <div className="mt-10">
          <ProfileSetupForm
            defaultContactEmail={user.contactEmail ?? verifiedContactEmails[0] ?? ""}
            verifiedContactEmails={verifiedContactEmails}
          />
        </div>
      </Container>
    </div>
  );
}
