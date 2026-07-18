"use server";

import { redirect } from "next/navigation";
import { AppCategory, Platform } from "@/generated/prisma";
import { requireDbUser, requireOnboardingPending } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { invalidatePublicCaches } from "@/lib/invalidate-public-caches";
import { field, isHttpUrl } from "@/lib/validation";

export type AppListingFormState = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<
    Record<"name" | "description" | "category" | "platform" | "logoUrl", string>
  >;
};

const CATEGORIES = new Set<string>(Object.values(AppCategory));
const PLATFORMS = new Set<string>(Object.values(Platform));

function validateListing(formData: FormData): {
  data?: {
    name: string;
    description: string;
    category: AppCategory;
    platform: Platform;
    logoUrl: string;
  };
  fieldErrors?: AppListingFormState["fieldErrors"];
  message?: string;
} {
  const name = field(formData, "name");
  const description = field(formData, "description");
  const category = field(formData, "category");
  const platform = field(formData, "platform");
  const logoUrl = field(formData, "logoUrl");

  const fieldErrors: AppListingFormState["fieldErrors"] = {};

  if (name.length < 2 || name.length > 80) {
    fieldErrors.name = "Name must be 2–80 characters.";
  }
  if (description.length < 20 || description.length > 2000) {
    fieldErrors.description = "Description must be 20–2000 characters.";
  }
  if (!CATEGORIES.has(category)) {
    fieldErrors.category = "Pick a category.";
  }
  if (!PLATFORMS.has(platform)) {
    fieldErrors.platform = "Pick a platform.";
  }
  if (logoUrl && !isHttpUrl(logoUrl)) {
    fieldErrors.logoUrl = "Logo must be an http(s) URL.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, message: "Fix the highlighted fields." };
  }

  return {
    data: {
      name,
      description,
      category: category as AppCategory,
      platform: platform as Platform,
      logoUrl: logoUrl || "",
    },
  };
}

/** Create an app listing (first or additional). Completes onboarding when still pending. */
export async function createAppListing(
  _prev: AppListingFormState,
  formData: FormData
): Promise<AppListingFormState> {
  const user = await requireDbUser();
  const parsed = validateListing(formData);
  if (!parsed.data) {
    return {
      ok: false,
      message: parsed.message ?? "Invalid form.",
      fieldErrors: parsed.fieldErrors,
    };
  }

  const listing = parsed.data;
  const needsProfile = !user.profileCompletedAt;
  let claimedFirstListing = false;

  const created = await prisma.$transaction(async (tx) => {
    if (!user.onboardingCompletedAt) {
      const claimed = await tx.user.updateMany({
        where: { id: user.id, onboardingCompletedAt: null },
        data: { onboardingCompletedAt: new Date() },
      });
      if (claimed.count === 0) {
        // Concurrent first submit already completed onboarding — avoid duplicate listing
        return null;
      }
      claimedFirstListing = true;
    }

    return tx.appListing.create({
      data: {
        userId: user.id,
        name: listing.name,
        description: listing.description,
        category: listing.category,
        platform: listing.platform,
        logoUrl: listing.logoUrl,
        status: "open_for_testing",
      },
    });
  });

  if (!created) {
    redirect(needsProfile ? "/onboarding/profile" : "/browse");
  }

  invalidatePublicCaches({
    listingId: created.id,
    githubUsername: user.githubUsername,
  });

  redirect(
    claimedFirstListing || needsProfile ? "/onboarding/profile" : "/browse"
  );
}

/** @deprecated alias — prefer createAppListing */
export async function createFirstApp(
  prev: AppListingFormState,
  formData: FormData
) {
  return createAppListing(prev, formData);
}

export async function skipOnboarding() {
  const user = await requireOnboardingPending();

  await prisma.user.updateMany({
    where: { id: user.id, onboardingCompletedAt: null },
    data: { onboardingCompletedAt: new Date() },
  });

  redirect("/onboarding/profile");
}
