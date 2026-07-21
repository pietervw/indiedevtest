import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Container } from "@/components/ui/section";
import { siteConfig, socialLinks } from "@/lib/site";

const links = [
  ...socialLinks,
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "llms.txt", href: "/llms.txt" },
];

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-paper-muted">
      <Container className="flex flex-col items-center gap-6 py-12 text-center">
        <BrandMark size="lg" />
        <p className="max-w-md text-ink-muted">
          Built by indie devs, for indie devs. Reciprocal testing so you can ship.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-6">
          {links.map((link) => {
            const className =
              "font-semibold text-ink transition-colors hover:text-brand-ink hover:underline decoration-brand underline-offset-4";
            if (link.href.startsWith("http")) {
              return (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  {link.label}
                </a>
              );
            }
            return (
              <Link key={link.label} href={link.href} className={className}>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <p className="text-sm text-ink-muted">
          © {new Date().getFullYear()} {siteConfig.legalName}. Free forever.
        </p>
      </Container>
    </footer>
  );
}
