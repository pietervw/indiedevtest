import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { Container, Section, SectionHeading } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Contact — IndieDevTest",
  description:
    "Questions, feedback, or ideas? Get in touch with the IndieDevTest team.",
};

export default function ContactPage() {
  return (
    <Section className="bg-grid">
      <Container className="max-w-2xl">
        <SectionHeading
          title="Get in touch"
          description="Questions, feedback, or ideas? Drop a message — we read everything."
        />
        <ContactForm />
      </Container>
    </Section>
  );
}
