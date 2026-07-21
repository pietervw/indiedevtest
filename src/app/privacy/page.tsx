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

        <LegalSection title="Accounts (GitHub + Clerk)">
          <p>
            You sign in with GitHub through Clerk. Clerk holds your
            authentication session and the GitHub account details needed to sign
            you in.
          </p>
          <p>
            After you sign in, we keep a local profile in our database with
            information such as your Clerk user id, GitHub id, GitHub username,
            display name, and profile image URL. You can also add an optional bio
            and X/Twitter handle during onboarding.
          </p>
        </LegalSection>

        <LegalSection title="Public profiles and listings">
          <p>
            Developer profiles and app listings you publish are meant to be
            public. That typically includes your display name, GitHub username,
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
            When you request to test someone’s app, you share an email address so
            that listing’s owner can add you in Play Console or TestFlight. That
            email is stored with the request and shown only to the owner of that
            listing — not to other testers or the public browse pages.
          </p>
        </LegalSection>

        <LegalSection title="Transactional email (SendGrid)">
          <p>
            We use SendGrid to send product emails. Those include contact-form
            messages, waitlist signup notices, and emails about tester requests
            (for example when someone asks to test your app, or when a request is
            accepted or declined). Reminder emails about listing milestones may
            also go out when that feature is enabled.
          </p>
        </LegalSection>

        <LegalSection title="Admin alerts (Pushover)">
          <p>
            If configured, the site can send optional Pushover notifications to
            the site admin for operational events such as a first-time signup, a
            waitlist signup, or a contact-form submission. Email addresses in
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

        <LegalSection title="Database hosting (Neon / Postgres)">
          <p>
            App data — profiles, listings, tester requests, assignments, reviews,
            and related records — lives in a Postgres database hosted on Neon.
          </p>
        </LegalSection>

        <LegalSection title="How long we keep data">
          <p>
            We keep account and listing data while your account and related
            records are active on the service. Waitlist signups may also be kept
            so we can email you later. We do not publish a separate automated
            deletion schedule on this page.
          </p>
        </LegalSection>

        <LegalSection title="Your requests">
          <p>
            If you want to ask about your data, correct something, or request
            deletion of your account or related records, contact us through the{" "}
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
