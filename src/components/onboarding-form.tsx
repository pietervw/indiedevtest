import { AppListingForm } from "@/components/app-listing-form";

/** Onboarding-specific wrapper (skip option enabled). */
export function OnboardingForm({ className }: { className?: string }) {
  return <AppListingForm className={className} showSkip />;
}
