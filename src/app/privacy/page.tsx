import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { LegalDoc, LegalLink, LegalSection } from "@/components/legal-doc";
import {
  canonicalMetadata,
  getSiteRouteOrThrow,
  legalWebPageJsonLd,
  siteConfig,
} from "@/lib/site";

const privacyRoute = getSiteRouteOrThrow("/privacy");
const privacyDescription = privacyRoute.description;
const privacyCanonical = canonicalMetadata("/privacy");

export const metadata: Metadata = {
  title: "Privacy",
  description: privacyDescription,
  alternates: privacyCanonical.alternates,
  openGraph: {
    ...privacyCanonical.openGraph,
    title: `Privacy | ${siteConfig.name}`,
    description: privacyDescription,
  },
};

const jsonLd = legalWebPageJsonLd({
  path: "/privacy",
  name: `Privacy | ${siteConfig.name}`,
  description: privacyDescription,
});

export default function PrivacyPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <LegalDoc
        title="Privacy"
        description={privacyDescription}
        updated="July 21, 2026"
      >
        <LegalSection title="What this page covers">
          <p>
            This page explains, in plain language, what {siteConfig.name} stores
            and shares when you use the site. It describes how the product works
            today — not legal advice, and not a guarantee beyond these product
            facts.
          </p>
        </LegalSection>

        <LegalSection title="Accounts (Clerk, email, and optional GitHub)">
          <p>
            You sign in through Clerk using email or, if you choose, GitHub.
            Clerk holds your authentication session and any linked provider
            details needed to sign you in.
          </p>
          <p>
            After you sign in, we keep a local profile in our database with
            information such as your Clerk user id, display name, profile image
            URL, and an optional linked GitHub id and username. You can also add
            a testing contact email, optional bio, and X/Twitter handle during
            onboarding.
          </p>
        </LegalSection>

        <LegalSection title="Public profiles and listings">
          <p>
            Developer profiles and app listings you publish are meant to be
            public. That typically includes your display name, profile handle,
            photo, bio, social handle if you added one, and the app details you
            post (name, description, logo, store or TestFlight link, platform,
            and status).
          </p>
          <p>
            Anyone can browse open listings. Do not put private secrets in
            profile text or listing copy.
          </p>
        </LegalSection>

        <LegalSection title="Tester emails">
          <p>
            Your saved testing contact email is stored on your private profile.
            When you request to test someone’s app, we snapshot and share it
            with that listing’s owner. When you accept a tester for your own
            app, we share your saved contact email with that tester. It is never
            shown on public browse pages or public profiles.
          </p>
        </LegalSection>

        <LegalSection title="Private tester feedback and devices">
          <p>
            When a tester has joined a testing track, they can submit private
            feedback about that app. We store the issue title, severity,
            details, optional reproduction steps, and an optional free-text
            device name. This feedback is visible to the tester who submitted
            it and the owner of the relevant listing, not to the public.
          </p>
          <p>
            Listing owners can mark feedback as unresolved, fixed, or skipped.
            That status is visible to the tester and the listing owner and helps
            them track the outcome of a report.
          </p>
        </LegalSection>

        <LegalSection title="Listing reports and moderation">
          <p>
            Signed-in members can privately report a listing for spam or scams,
            inappropriate content, misleading links, impersonation, or another
            concern. We store the report, its optional explanation, and the
            reporting account so the site admin can investigate and prevent
            duplicate reports. The listing owner is not shown the reporter’s
            identity.
          </p>
        </LegalSection>

        <LegalSection title="Transactional email (SendGrid)">
          <p>
            We use SendGrid to send product emails. Those include contact-form
            messages and emails about tester requests
            (for example when someone asks to test your app, or when a request is
            accepted or declined). Reminder emails about listing milestones may
            also go out when that feature is enabled.
          </p>
        </LegalSection>

        <LegalSection title="Admin alerts (Pushover)">
          <p>
            If configured, the site can send optional Pushover notifications to
            the site admin for operational events such as a first-time signup, a
            contact-form submission, a tester request, or a listing report. Email addresses in
            those alerts are masked where applicable.
          </p>
        </LegalSection>

        <LegalSection title="Analytics (Umami)">
          <p>
            Analytics are optional. If Umami is configured for the deployment, a
            self-hosted Umami script may load to collect basic page-view style
            usage data. If those settings are empty, the script is not loaded.
          </p>
        </LegalSection>

        <LegalSection title="Error monitoring (Sentry)">
          <p>
            Error monitoring is optional. If Sentry is configured for the
            deployment, it receives error reports and limited performance
            telemetry from the browser, server, and edge runtime so we can find
            and fix reliability issues. If the Sentry settings are empty, this
            monitoring is not enabled.
          </p>
        </LegalSection>

        <LegalSection title="Database hosting (Neon / Postgres)">
          <p>
            App data — profiles, listings, tester requests, assignments, reviews,
            and related records — lives in a Postgres database hosted on Neon.
          </p>
        </LegalSection>

        <LegalSection title="How long we keep data">
          <p>
            We keep account and listing data while your account and related
            records are active on the service. You can permanently delete your
            account from Profile settings; this permanently takes your profile,
            listings, tester activity, and feedback offline immediately and
            cannot be undone.
          </p>
        </LegalSection>

        <LegalSection title="Your requests">
          <p>
            If you want to ask about your data or correct something, contact us through the{" "}
            <LegalLink href="/contact">contact form</LegalLink>. We will respond
            as best we can for a small indie product.
          </p>
        </LegalSection>

        <LegalSection title="Changes">
          <p>
            If how the product handles data changes in a meaningful way, we will
            update this page and the “Last updated” date above.
          </p>
        </LegalSection>
      </LegalDoc>
    </>
  );
}
