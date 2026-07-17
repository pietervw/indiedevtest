import Link from "next/link";
import { AuthControls } from "@/components/auth-controls";
import { BrandMark } from "@/components/brand-mark";
import { Container } from "@/components/ui/section";

const navLinkClassName =
  "text-sm font-semibold text-ink-muted transition-colors hover:text-ink";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink bg-paper">
      <Container className="flex h-16 items-center justify-between">
        <BrandMark size="md" />
        <nav aria-label="Primary" className="flex items-center gap-3 sm:gap-4">
          <Link href="/browse" className={navLinkClassName}>
            Browse
          </Link>
          <Link href="/apps/new" className={navLinkClassName}>
            Add
          </Link>
          <AuthControls />
        </nav>
      </Container>
    </header>
  );
}
