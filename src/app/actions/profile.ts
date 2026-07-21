"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireDbUser, requireProfileSetupPending } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { invalidateDevProfileCache } from "@/lib/dev-profile";
import { field, isHttpUrl, isValidEmail, normalizeEmail } from "@/lib/validation";
import { getVerifiedClerkEmails } from "@/lib/verified-clerk-emails";
import { profilePath } from "@/lib/mock-data";

export type ProfileSetupState = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<Record<"contactEmail" | "bio" | "twitterHandle", string>>;
};

export type ContactEmailState = {
  ok: boolean;
  message: string;
  fieldErrors?: { contactEmail?: string };
};

export type ProfileSettingsState = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<
    Record<"contactEmail" | "bio" | "twitterHandle" | "trustMrrProfileUrl", string>
  >;
};

function normalizeTwitterHandle(raw: string): string {
  return raw.replace(/^@+/, "").trim();
}

function validateTrustMrrProfileUrl(raw: string): string | null | undefined {
  const url = raw.trim();
  if (!url) return null;
  if (!isHttpUrl(url)) return undefined;
  try {
    const parsed = new URL(url);
    const isTrustMrr =
      parsed.protocol === "https:" &&
      (parsed.hostname === "trustmrr.com" || parsed.hostname === "www.trustmrr.com") &&
      parsed.pathname.startsWith("/founder/");
    return isTrustMrr ? url : undefined;
  } catch {
    return undefined;
  }
}

async function validateVerifiedContactEmail(
  rawEmail: string
): Promise<{ email?: string; error?: string }> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return { error: "Choose a valid email address." };
  }

  const verifiedEmails = await getVerifiedClerkEmails();
  if (!verifiedEmails.includes(email)) {
    return {
      error:
        "Choose an email verified on your Clerk account. Add or verify an address in the account menu first.",
    };
  }
  return { email };
}

export async function completeProfileSetup(
  _prev: ProfileSetupState,
  formData: FormData
): Promise<ProfileSetupState> {
  const user = await requireProfileSetupPending();
  const contactEmailResult = await validateVerifiedContactEmail(
    field(formData, "contactEmail")
  );
  const bio = field(formData, "bio");
  const twitterHandle = normalizeTwitterHandle(field(formData, "twitterHandle"));
  const fieldErrors: ProfileSetupState["fieldErrors"] = {};

  if (contactEmailResult.error) fieldErrors.contactEmail = contactEmailResult.error;
  if (bio.length > 280) fieldErrors.bio = "Bio must be 280 characters or fewer.";
  if (twitterHandle && !/^[A-Za-z0-9_]{1,15}$/.test(twitterHandle)) {
    fieldErrors.twitterHandle =
      "Use a valid X/Twitter handle (letters, numbers, underscore).";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Fix the highlighted fields.", fieldErrors };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      contactEmail: contactEmailResult.email!,
      bio: bio || null,
      twitterHandle: twitterHandle || null,
      profileCompletedAt: new Date(),
    },
  });

  invalidateDevProfileCache(user.profileSlug);
  redirect("/browse");
}

/** Update the private email used for future tester requests and invitations. */
export async function updateTestingContactEmail(
  _prev: ContactEmailState,
  formData: FormData
): Promise<ContactEmailState> {
  const user = await requireDbUser();
  const result = await validateVerifiedContactEmail(field(formData, "contactEmail"));
  if (result.error) {
    return {
      ok: false,
      message: "Choose a verified email address.",
      fieldErrors: { contactEmail: result.error },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { contactEmail: result.email! },
  });

  // Existing TesterRequest rows deliberately retain their historical email
  // snapshot. Only future requests use this new address.
  return { ok: true, message: "Testing contact email updated." };
}

/** Update all editable public/private profile preferences from Settings. */
export async function updateProfileSettings(
  _prev: ProfileSettingsState,
  formData: FormData
): Promise<ProfileSettingsState> {
  const user = await requireDbUser();
  const contactEmailResult = await validateVerifiedContactEmail(
    field(formData, "contactEmail")
  );
  const bio = field(formData, "bio");
  const twitterHandle = normalizeTwitterHandle(field(formData, "twitterHandle"));
  const trustMrrProfileUrl = validateTrustMrrProfileUrl(
    field(formData, "trustMrrProfileUrl")
  );
  const fieldErrors: ProfileSettingsState["fieldErrors"] = {};

  if (contactEmailResult.error) fieldErrors.contactEmail = contactEmailResult.error;
  if (bio.length > 280) fieldErrors.bio = "Bio must be 280 characters or fewer.";
  if (twitterHandle && !/^[A-Za-z0-9_]{1,15}$/.test(twitterHandle)) {
    fieldErrors.twitterHandle =
      "Use a valid X/Twitter handle (letters, numbers, underscore).";
  }
  if (trustMrrProfileUrl === undefined) {
    fieldErrors.trustMrrProfileUrl =
      "Use an HTTPS TrustMRR founder profile URL (trustmrr.com/founder/...).";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Fix the highlighted fields.", fieldErrors };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      contactEmail: contactEmailResult.email!,
      bio: bio || null,
      twitterHandle: twitterHandle || null,
      trustMrrProfileUrl,
    },
  });
  invalidateDevProfileCache(user.profileSlug);
  revalidatePath("/settings/profile");
  revalidatePath(profilePath(user.profileSlug));
  return { ok: true, message: "Profile settings updated." };
}
