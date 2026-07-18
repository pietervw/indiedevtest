"use server";

import { redirect } from "next/navigation";
import { requireProfileSetupPending } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { invalidateDevProfileCache } from "@/lib/dev-profile";
import { field } from "@/lib/validation";

export type ProfileSetupState = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<Record<"bio" | "twitterHandle", string>>;
};

function normalizeTwitterHandle(raw: string): string {
  return raw.replace(/^@+/, "").trim();
}

export async function completeProfileSetup(
  _prev: ProfileSetupState,
  formData: FormData
): Promise<ProfileSetupState> {
  const user = await requireProfileSetupPending();

  const bio = field(formData, "bio");
  const twitterHandle = normalizeTwitterHandle(field(formData, "twitterHandle"));

  const fieldErrors: ProfileSetupState["fieldErrors"] = {};

  if (bio.length > 280) {
    fieldErrors.bio = "Bio must be 280 characters or fewer.";
  }
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
      bio: bio || null,
      twitterHandle: twitterHandle || null,
      profileCompletedAt: new Date(),
    },
  });

  invalidateDevProfileCache(user.githubUsername);

  redirect("/browse");
}

export async function skipProfileSetup() {
  const user = await requireProfileSetupPending();

  await prisma.user.update({
    where: { id: user.id },
    data: { profileCompletedAt: new Date() },
  });

  redirect("/browse");
}
