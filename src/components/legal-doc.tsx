import Link from "next/link";
import { Container, Section, SectionHeading } from "@/components/ui/section";

export function LegalDoc({
  title,
  description,
  updated,
  children,
}: {
  title: string;
  description: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <Section className="bg-grid">
      <Container className="max-w-2xl">
        <SectionHeading title={title} description={description} />
        <p className="mb-10 text-center text-sm text-ink-muted">
          Last updated {updated}
        </p>
        <article className="space-y-10 text-base leading-relaxed text-ink-muted md:text-lg">
          {children}
        </article>
      </Container>
    </Section>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-extrabold text-ink md:text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LegalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const className =
    "font-semibold text-ink underline decoration-brand underline-offset-4 hover:text-brand-ink";
  if (href.startsWith("http") || href.startsWith("mailto:")) {
    return (
      <a
        href={href}
        className={className}
        {...(href.startsWith("http")
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
