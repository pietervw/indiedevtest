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
        <UserButton>
          <UserButton.MenuItems>
            <UserButton.Link
              label="Profile"
              href="/settings/profile"
              labelIcon={<ProfileIcon />}
            />
          </UserButton.MenuItems>
        </UserButton>
      </Show>
    </>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c.9-3.4 3.4-5.1 7.5-5.1s6.6 1.7 7.5 5.1" />
    </svg>
  );
}
