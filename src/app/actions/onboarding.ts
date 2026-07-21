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
    Record<
      | "name"
      | "description"
      | "category"
      | "platform"
      | "logoUrl"
      | "testingAccessUrl"
      | "testerInstructions"
      | "testerCapacity",
      string
    >
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
    testingAccessUrl: string;
    testerInstructions: string;
    testerCapacity: number | null;
  };
  fieldErrors?: AppListingFormState["fieldErrors"];
  message?: string;
} {
  const name = field(formData, "name");
  const description = field(formData, "description");
  const category = field(formData, "category");
  const platform = field(formData, "platform");
  const logoUrl = field(formData, "logoUrl");
  const testingAccessUrl = field(formData, "testingAccessUrl");
  const testerInstructions = field(formData, "testerInstructions");
  const testerCapacityRaw = field(formData, "testerCapacity");

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
  if (testingAccessUrl && !isHttpUrl(testingAccessUrl)) {
    fieldErrors.testingAccessUrl = "Testing link must be an http(s) URL.";
  }
  if (testingAccessUrl.length > 500) {
    fieldErrors.testingAccessUrl = "Testing link must be 500 characters or fewer.";
  }
  if (testerInstructions.length > 2000) {
    fieldErrors.testerInstructions = "Instructions must be 2,000 characters or fewer.";
  }
  const testerCapacity = testerCapacityRaw ? Number(testerCapacityRaw) : null;
  if (
    testerCapacity !== null &&
    (!Number.isInteger(testerCapacity) || testerCapacity < 1 || testerCapacity > 10000)
  ) {
    fieldErrors.testerCapacity = "Tester capacity must be a whole number from 1 to 10,000.";
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
      testingAccessUrl,
      testerInstructions,
      testerCapacity,
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
        testingAccessUrl: listing.testingAccessUrl || null,
        testerInstructions: listing.testerInstructions || null,
        testerCapacity: listing.testerCapacity,
        status: "open_for_testing",
      },
    });
  });

  if (!created) {
    redirect(needsProfile ? "/onboarding/profile" : "/browse");
  }

  invalidatePublicCaches({
    listingId: created.id,
    profileSlugs: user.profileSlug,
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
