import { ProfileSettingsForm } from "@/components/testing-contact-email-form";
import { Container } from "@/components/ui/section";
import { requireDbUser } from "@/lib/auth-guards";
import { canonicalMetadata } from "@/lib/site";
import { getVerifiedClerkEmails } from "@/lib/verified-clerk-emails";
import type { Metadata } from "next";

export const metadata: Metadata = {
  ...canonicalMetadata("/settings/profile"),
  title: "Profile settings",
  robots: { index: false, follow: false },
};

export default async function ProfileSettingsPage() {
  const [user, verifiedEmails] = await Promise.all([
    requireDbUser(),
    getVerifiedClerkEmails(),
  ]);

  return (
    <div className="flex-1 bg-grid">
      <Container className="py-14 md:py-20">
        <h1 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
          Profile settings
        </h1>
        <p className="mt-3 max-w-xl text-lg text-ink-muted">
          Manage your public profile and the private email used to coordinate
          reciprocal testing.
        </p>
        <ProfileSettingsForm
          currentEmail={user.contactEmail}
          verifiedEmails={verifiedEmails}
          bio={user.bio}
          twitterHandle={user.twitterHandle}
          trustMrrProfileUrl={user.trustMrrProfileUrl}
        />
      </Container>
    </div>
  );
}
