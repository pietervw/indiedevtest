import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { LegalDoc, LegalLink, LegalSection } from "@/components/legal-doc";
import {
  canonicalMetadata,
  getSiteRouteOrThrow,
  legalWebPageJsonLd,
  siteConfig,
} from "@/lib/site";

const termsRoute = getSiteRouteOrThrow("/terms");
const termsDescription = termsRoute.description;
const termsCanonical = canonicalMetadata("/terms");

export const metadata: Metadata = {
  title: "Terms",
  description: termsDescription,
  alternates: termsCanonical.alternates,
  openGraph: {
    ...termsCanonical.openGraph,
    title: `Terms | ${siteConfig.name}`,
    description: termsDescription,
  },
};

const jsonLd = legalWebPageJsonLd({
  path: "/terms",
  name: `Terms | ${siteConfig.name}`,
  description: termsDescription,
});

export default function TermsPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <LegalDoc
        title="Terms"
        description={termsDescription}
        updated="July 21, 2026"
      >
        <LegalSection title="Using IndieDevTest">
          <p>
            {siteConfig.name} is a free reciprocal testing community for indie
            Android and iOS developers. You post apps that need testers, help
            test other people’s apps, and coordinate installs through the tools
            on this site.
          </p>
          <p>
            These terms are plain-language product rules — not legal advice, and
            not a full commercial contract.
          </p>
        </LegalSection>

        <LegalSection title="Accounts">
          <p>
            You need a Clerk account to use member features. You can sign in
            with email or GitHub. Keep your sign-in method secure; you are
            responsible for activity under your signed-in profile.
          </p>
        </LegalSection>

        <LegalSection title="What you post is public">
          <p>
            Profiles and listings you publish are public by design. Only share
            store or TestFlight links and details you are comfortable showing to
            other indie developers and to anyone who can open the page.
          </p>
        </LegalSection>

        <LegalSection title="Tester emails">
          <p>
            Your saved testing contact email is shared with the owner when you
            request to test an app, and with an accepted tester for your own
            app. Use an address you are willing to share for that purpose.
          </p>
        </LegalSection>

        <LegalSection title="Private tester feedback">
          <p>
            Testers can send private feedback to a listing owner after joining a
            testing track. Feedback can include an issue title, severity,
            details, reproduction steps, and an optional device name. The
            listing owner can view that feedback and mark it unresolved, fixed,
            or skipped. It is not displayed on public listing pages.
          </p>
        </LegalSection>

        <LegalSection title="Deleting your account">
          <p>
            You can permanently delete your account from Profile settings. This
            takes your public profile, listings, tester requests, assignments,
            and feedback offline and cannot be undone. Do this only when you
            are sure you no longer need the account or its history.
          </p>
        </LegalSection>

        <LegalSection title="Be a good community member">
          <p>
            Use the site for genuine reciprocal testing. Do not spam, harass,
            scrape personal data, post malware or abusive content, or try to
            break or overload the service. Listing owners decide whether to
            accept a tester request; the site may hide or remove listings that
            breach these rules. The site does not guarantee slots or launch
            outcomes.
          </p>
        </LegalSection>

        <LegalSection title="Third-party services">
          <p>
            Sign-in, email delivery, optional analytics, optional admin alerts,
            and database hosting rely on third parties (including Clerk/GitHub,
            SendGrid, Umami when enabled, Sentry when enabled, Pushover when
            enabled, and Neon).
            Their own terms and privacy practices also apply to what they
            process.
          </p>
        </LegalSection>

        <LegalSection title="Availability">
          <p>
            The product is provided as-is by a small indie team. Features may
            change, and the site may be unavailable at times. We do not promise
            uninterrupted service or specific tester counts.
          </p>
        </LegalSection>

        <LegalSection title="Privacy">
          <p>
            How we handle data is described on the{" "}
            <LegalLink href="/privacy">privacy page</LegalLink>.
          </p>
        </LegalSection>

        <LegalSection title="Questions">
          <p>
            Questions about these terms or the product? Use the{" "}
            <LegalLink href="/contact">contact form</LegalLink>.
          </p>
        </LegalSection>

        <LegalSection title="Changes">
          <p>
            If these product rules change, we will update this page and the
            “Last updated” date above.
          </p>
        </LegalSection>
      </LegalDoc>
    </>
  );
}
