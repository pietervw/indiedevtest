"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

const navLinkClassName =
  "cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-ink-muted transition-colors hover:text-ink";

export function AuthControls() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton
          mode="redirect"
          forceRedirectUrl="/onboarding"
          signUpForceRedirectUrl="/onboarding"
        >
          <button type="button" className={navLinkClassName}>
            Sign in
          </button>
        </SignInButton>
        <SignUpButton
          mode="redirect"
          forceRedirectUrl="/onboarding"
          signInForceRedirectUrl="/onboarding"
        >
          <button type="button" className={navLinkClassName}>
            Sign up
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
