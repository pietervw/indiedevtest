import { AppBoard } from "@/components/app-board";
import { BrandMark } from "@/components/brand-mark";
import { JsonLd } from "@/components/json-ld";
import { LeaderboardBoards } from "@/components/leaderboard-boards";
import { WaitlistForm } from "@/components/waitlist-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Container,
  Section,
  SectionHeading,
} from "@/components/ui/section";
import { getHomeTopAppsNeedingTesters } from "@/lib/home-top-apps";
import { getLeaderboards } from "@/lib/leaderboards";
import {
  absoluteUrl,
  canonicalMetadata,
  howItWorksSteps,
  siteConfig,
  siteFaqs,
  socialLinks,
} from "@/lib/site";
import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

export const metadata: Metadata = canonicalMetadata("/");

/** Request-time homepage: live DB queries with short in-memory caches. */

const reasons = [
  {
    title: "No more begging friends",
    body: "Stop forcing your mom to install v0.3. Get builders who actually care.",
  },
  {
    title: "Real indie testers",
    body: "Every tester is shipping their own app. Better feedback. Zero bots.",
  },
  {
    title: "Built-in reciprocity",
    body: "Give testing, get testing. The more you help, the faster you launch.",
  },
  {
    title: "Reputation that sticks",
    body: "Climb the board, earn trust, become the tester everyone wants.",
  },
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    url: siteConfig.url,
    description: siteConfig.description,
    logo: absoluteUrl("/icon"),
    sameAs: socialLinks.map((link) => link.href),
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    url: siteConfig.url,
    name: siteConfig.name,
    description: siteConfig.description,
    publisher: { "@id": absoluteUrl("/#organization") },
    inLanguage: "en-US",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": absoluteUrl("/#app"),
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Android, iOS, Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    provider: { "@id": absoluteUrl("/#organization") },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": absoluteUrl("/#webpage"),
    url: absoluteUrl("/"),
    name: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    isPartOf: { "@id": absoluteUrl("/#website") },
    about: { "@id": absoluteUrl("/#app") },
    primaryImageOfPage: absoluteUrl("/opengraph-image"),
    inLanguage: "en-US",
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": absoluteUrl("/#faq"),
    mainEntity: siteFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  },
];

export default async function Home() {
  await connection();
  const [topApps, leaderboards] = await Promise.all([
    getHomeTopAppsNeedingTesters(),
    getLeaderboards(),
  ]);

  return (
    <>
      <JsonLd data={jsonLd} />

      <section className="relative border-b-2 border-ink bg-grid">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-brand/30" />
        </div>

        <Container className="relative grid items-center gap-12 py-14 md:grid-cols-2 md:gap-10 md:py-20 lg:py-24">
          <div>
            <BrandMark size="hero" />
            <h1 className="mt-6 font-display text-3xl font-extrabold leading-[1.15] text-ink sm:text-4xl md:text-5xl">
              Find 12 testers.
              <br />
              Launch your app.
            </h1>
            <p className="mt-5 max-w-md text-lg text-ink-muted md:text-xl">
              Indie devs help each other clear Google Play&apos;s 14-day tester
              wall — no friends, no family, no luck.
            </p>
            <div id="waitlist" className="mt-8 scroll-mt-24">
              <WaitlistForm />
              <p className="mt-3 text-sm font-medium text-ink-muted">
                Free forever · Join our community
              </p>
            </div>
          </div>

          <div>
            {topApps.length > 0 ? (
              <>
                <AppBoard apps={topApps} />
                <p className="mt-3 text-center text-sm text-ink-muted md:text-left">
                  <Link
                    href="/browse"
                    className="font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4"
                  >
                    Browse all apps
                  </Link>
                </p>
              </>
            ) : (
              <p className="rounded-2xl border-2 border-ink bg-paper p-8 text-ink-muted shadow-brutal">
                No apps waiting on testers yet.{" "}
                <Link href="/browse" className="font-semibold text-ink underline">
                  Browse
                </Link>{" "}
                or list yours after signing in.
              </p>
            )}
          </div>
        </Container>
      </section>

      <Section id="how" className="border-b-2 border-ink bg-paper">
        <Container>
          <SectionHeading
            title="How it works"
            description="Three steps. Zero drama. Reciprocal by design."
          />
          <ol className="grid gap-8 md:grid-cols-3 md:gap-6">
            {howItWorksSteps.map((step) => (
              <li key={step.n} className="text-center md:text-left">
                <span className="font-display text-5xl font-extrabold text-brand [text-shadow:3px_3px_0_var(--ink)]">
                  {step.n}
                </span>
                <h3 className="mt-3 font-display text-xl font-bold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section className="border-b-2 border-ink bg-brand">
        <Container className="max-w-3xl text-center">
          <Badge variant="dark" size="md" className="mb-6">
            From the waitlist
          </Badge>
          <blockquote className="font-display text-2xl font-extrabold leading-snug text-brand-ink md:text-4xl">
            &ldquo;I was stuck at 3 testers for weeks. IndieDevTest got me to 14
            in 2 days.&rdquo;
          </blockquote>
          <footer className="mt-6 font-semibold text-brand-ink/80">
            — Sarah, TaskMaster Pro
          </footer>
        </Container>
      </Section>

      <Section id="why" className="border-b-2 border-ink bg-paper">
        <Container>
          <SectionHeading
            title="Why indie devs stick"
            description="Reddit takes weeks. Twitter is lottery. This is builders helping builders."
          />
          <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {reasons.map((reason) => (
              <li key={reason.title} className="border-l-4 border-brand pl-5">
                <h3 className="font-display text-xl font-bold text-ink">
                  {reason.title}
                </h3>
                <p className="mt-2 text-ink-muted">{reason.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section id="leaderboards" className="border-b-2 border-ink bg-paper-muted">
        <Container>
          <SectionHeading
            title="Leaderboards"
            description="Climb by testing, launching, and leaving useful feedback."
          />
          <LeaderboardBoards boards={leaderboards} />
        </Container>
      </Section>

      <Section id="faq" className="border-b-2 border-ink bg-paper">
        <Container>
          <SectionHeading
            title="FAQ"
            description="Quick answers before you join the waitlist."
          />
          <dl className="mx-auto max-w-3xl space-y-8">
            {siteFaqs.map((faq) => (
              <div key={faq.question}>
                <dt className="font-display text-xl font-bold text-ink">
                  {faq.question}
                </dt>
                <dd className="mt-2 text-ink-muted">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      <Section className="border-b-2 border-ink bg-ink text-paper">
        <Container className="max-w-2xl text-center">
          <h2 className="font-display text-3xl font-extrabold md:text-5xl">
            Free. Forever.
          </h2>
          <p className="mt-4 text-lg text-paper/60 md:text-xl">
            No credit card. No premium tiers. No bait-and-switch. Built by indie
            devs — this platform stays free.
          </p>
          <div className="mt-8 flex justify-center">
            <Button href="#waitlist" size="xl">
              Claim your spot
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
