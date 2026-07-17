import { AppBoard } from "@/components/app-board";
import { BrandMark } from "@/components/brand-mark";
import { WaitlistForm } from "@/components/waitlist-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Container,
  Section,
  SectionHeading,
} from "@/components/ui/section";
import { mockApps } from "@/lib/mock-data";

const steps = [
  {
    n: "01",
    title: "Post your app",
    body: "Drop your Play Store or TestFlight link in under 2 minutes.",
  },
  {
    n: "02",
    title: "Test other apps",
    body: "Help fellow indie builders — real installs, real feedback.",
  },
  {
    n: "03",
    title: "Get to 12/14",
    body: "Reciprocity fills your tester slots so you can ship.",
  },
];

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

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden border-b-2 border-ink bg-grid">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand/30" />

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
                Free forever · 500+ indie builders waiting
              </p>
            </div>
          </div>

          <AppBoard apps={mockApps} />
        </Container>
      </section>

      <Section id="how" className="border-b-2 border-ink bg-paper">
        <Container>
          <SectionHeading
            title="How it works"
            description="Three steps. Zero drama. Reciprocal by design."
          />
          <ol className="grid gap-8 md:grid-cols-3 md:gap-6">
            {steps.map((step) => (
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
          <p className="mt-6 font-semibold text-brand-ink/80">
            — Sarah, TaskMaster Pro
          </p>
        </Container>
      </Section>

      <Section className="border-b-2 border-ink bg-paper">
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
