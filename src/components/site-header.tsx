import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/section";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink bg-paper">
      <Container className="flex h-16 items-center justify-between">
        <BrandMark size="md" />
        <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-3">
          <a
            href="#how"
            className="hidden text-sm font-semibold text-ink-muted transition-colors hover:text-ink sm:inline"
          >
            How it works
          </a>
          <a
            href="/contact"
            className="hidden text-sm font-semibold text-ink-muted transition-colors hover:text-ink sm:inline"
          >
            Contact
          </a>
          <Button href="#waitlist" size="sm">
            Join waitlist
          </Button>
        </nav>
      </Container>
    </header>
  );
}
