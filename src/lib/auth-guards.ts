import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { User } from "@/generated/prisma";
import { ensureDbUser } from "@/lib/user";

export async function requireDbUser(): Promise<User> {
  const { isAuthenticated, redirectToSignIn } = await auth();
  if (!isAuthenticated) {
    redirectToSignIn();
    redirect("/");
  }

  const user = await ensureDbUser();
  if (!user) {
    redirect("/auth/github-required");
  }

  return user;
}

/** Signed-in users who still need the listing step. */
export async function requireOnboardingPending(): Promise<User> {
  const user = await requireDbUser();
  if (user.onboardingCompletedAt) {
    if (!user.profileCompletedAt) {
      redirect("/onboarding/profile");
    }
    redirect("/browse");
  }
  return user;
}

/** Listing done; profile bio/Twitter step still open. */
export async function requireProfileSetupPending(): Promise<User> {
  const user = await requireDbUser();
  if (!user.onboardingCompletedAt) {
    redirect("/onboarding");
  }
  if (user.profileCompletedAt && user.contactEmail) {
    redirect("/browse");
  }
  return user;
}

/** Finished listing + profile onboarding. */
export async function requireOnboarded(): Promise<User> {
  const user = await requireDbUser();
  if (!user.onboardingCompletedAt) {
    redirect("/onboarding");
  }
  if (!user.profileCompletedAt) {
    redirect("/onboarding/profile");
  }
  return user;
}

/** Optional session user for public pages (never redirects). */
export async function getOptionalDbUser() {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) return null;
  return ensureDbUser();
}
