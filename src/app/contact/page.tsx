import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { JsonLd } from "@/components/json-ld";
import { Container, Section, SectionHeading } from "@/components/ui/section";
import { absoluteUrl, siteConfig, siteRoutes } from "@/lib/site";

const contactRoute = siteRoutes.find((route) => route.path === "/contact");

if (!contactRoute) {
  throw new Error("Missing /contact entry in siteRoutes");
}

const contactDescription = contactRoute.description;

export const metadata: Metadata = {
  title: "Contact",
  description: contactDescription,
  alternates: {
    canonical: absoluteUrl("/contact"),
  },
  openGraph: {
    title: `Contact | ${siteConfig.name}`,
    description: contactDescription,
    url: absoluteUrl("/contact"),
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "@id": absoluteUrl("/contact#webpage"),
  url: absoluteUrl("/contact"),
  name: `Contact | ${siteConfig.name}`,
  description: contactDescription,
  isPartOf: { "@id": absoluteUrl("/#website") },
  about: { "@id": absoluteUrl("/#organization") },
  inLanguage: "en-US",
};

export default function ContactPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <Section className="bg-grid">
        <Container className="max-w-2xl">
          <SectionHeading
            title="Get in touch"
            description={contactDescription}
          />
          <ContactForm />
        </Container>
      </Section>
    </>
  );
}
