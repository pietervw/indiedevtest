"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AppCategory,
  AppListingStatus,
  Platform,
} from "@/generated/prisma";
import { requireDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { isAllowedStatusTransition } from "@/lib/listing-status";
import { appPath } from "@/lib/mock-data";

export type UpdateListingState = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<
    Record<
      | "name"
      | "description"
      | "category"
      | "platform"
      | "logoUrl"
      | "status"
      | "storeLink",
      string
    >
  >;
};

const CATEGORIES = new Set<string>(Object.values(AppCategory));
const PLATFORMS = new Set<string>(Object.values(Platform));
const STATUSES = new Set<string>(Object.values(AppListingStatus));

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function updateAppListing(
  listingId: string,
  _prev: UpdateListingState,
  formData: FormData
): Promise<UpdateListingState> {
  const user = await requireDbUser();

  const listing = await prisma.appListing.findUnique({
    where: { id: listingId },
  });

  if (!listing || listing.userId !== user.id) {
    return { ok: false, message: "You can only edit your own listings." };
  }

  const name = field(formData, "name");
  const description = field(formData, "description");
  const category = field(formData, "category");
  const platform = field(formData, "platform");
  const logoUrl = field(formData, "logoUrl");
  const status = field(formData, "status");
  const storeLink = field(formData, "storeLink");

  const fieldErrors: UpdateListingState["fieldErrors"] = {};

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
  if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
    fieldErrors.logoUrl = "Logo must be an http(s) URL.";
  }
  if (!STATUSES.has(status)) {
    fieldErrors.status = "Pick a valid status.";
  } else if (
    !isAllowedStatusTransition(
      listing.status,
      status as AppListingStatus
    )
  ) {
    fieldErrors.status =
      "That status change isn’t allowed. Follow Draft → Open → Closed (optional) → Testing Complete → Launched.";
  }

  if (status === "launched") {
    if (!storeLink) {
      fieldErrors.storeLink = "Store link is required when marking as Launched.";
    } else if (!/^https?:\/\//i.test(storeLink)) {
      fieldErrors.storeLink = "Store link must be an http(s) URL.";
    }
  } else if (storeLink && !/^https?:\/\//i.test(storeLink)) {
    fieldErrors.storeLink = "Store link must be an http(s) URL.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Fix the highlighted fields.", fieldErrors };
  }

  await prisma.appListing.update({
    where: { id: listingId },
    data: {
      name,
      description,
      category: category as AppCategory,
      platform: platform as Platform,
      logoUrl: logoUrl || "",
      status: status as AppListingStatus,
      storeLink:
        status === "launched"
          ? storeLink
          : storeLink || null,
    },
  });

  revalidatePath("/browse");
  revalidatePath("/");
  revalidatePath(appPath(listingId));
  revalidatePath(`/apps/${listingId}/edit`);

  redirect(appPath(listingId));
}
