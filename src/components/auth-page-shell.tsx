import type { Metadata } from "next";
import { Container } from "@/components/ui/section";

export function authPageMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: false },
  };
}

/** Shared shell for /sign-in and /sign-up Clerk component pages. */
export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-grid">
      <Container className="flex flex-col items-center justify-center py-14 md:py-20">
        {children}
      </Container>
    </div>
  );
}
