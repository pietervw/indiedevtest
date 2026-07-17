import { BrandMark } from "@/components/brand-mark";
import { Container } from "@/components/ui/section";

const links = [
  { label: "Twitter", href: "#" },
  { label: "GitHub", href: "#" },
  { label: "Discord", href: "#" },
  { label: "Contact", href: "/contact" },
];

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-paper-muted">
      <Container className="flex flex-col items-center gap-6 py-12 text-center">
        <BrandMark size="lg" />
        <p className="max-w-md text-ink-muted">
          Built by indie devs, for indie devs. Reciprocal testing so you can ship.
        </p>
        <div className="flex gap-6">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-semibold text-ink transition-colors hover:text-brand-ink hover:underline decoration-brand underline-offset-4"
            >
              {link.label}
            </a>
          ))}
        </div>
        <p className="text-sm text-ink-muted">
          © {new Date().getFullYear()} IndieDevTest. Free forever.
        </p>
      </Container>
    </footer>
  );
}
