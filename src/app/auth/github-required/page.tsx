"use client";

import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/section";

export default function GitHubRequiredPage() {
  return (
    <div className="flex-1 bg-grid">
      <Container className="py-14 md:py-20">
        <h1 className="max-w-xl font-display text-3xl font-extrabold text-ink sm:text-4xl">
          We couldn&apos;t set up your account
        </h1>
        <p className="mt-4 max-w-lg text-lg text-ink-muted">
          Try signing in again. You can use either email or a GitHub-connected
          Clerk account.
        </p>
        <div className="mt-8">
          <SignOutButton redirectUrl="/">
            <Button type="button" size="md">
              Sign out
            </Button>
          </SignOutButton>
        </div>
      </Container>
    </div>
  );
}
