"use server";

import { isClerkAPIResponseError } from "@clerk/backend/errors";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { invalidatePublicCaches } from "@/lib/invalidate-public-caches";
import { appPath, profilePath } from "@/lib/mock-data";
import { field } from "@/lib/validation";

export type DeleteAccountState = { ok: boolean; message: string };

function isClerkUserAlreadyDeleted(error: unknown): boolean {
  return (
    isClerkAPIResponseError(error) &&
    (error.status === 404 ||
      error.errors.some((e) => e.code === "resource_not_found"))
  );
}

/** Permanently removes the account and all locally owned data. Database cascades
 * take listings and the public developer profile offline in the same deletion. */
export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  if (field(formData, "confirmation") !== "DELETE") {
    return { ok: false, message: 'Type DELETE to confirm permanent account deletion.' };
  }

  const user = await requireDbUser();

  // Delete Clerk first so a failed remote delete leaves the local row intact.
  // Otherwise ensureDbUser would recreate a profile on the next sign-in.
  // Treat "already deleted" as success so a retry can finish local cleanup if
  // Clerk succeeded earlier but the database delete failed.
  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(user.clerkId);
  } catch (error) {
    if (!isClerkUserAlreadyDeleted(error)) {
      console.error("[account] Clerk account deletion failed", error);
      return {
        ok: false,
        message: "Could not delete your sign-in account. Please try again or contact support.",
      };
    }
  }

  const listingIds = await prisma.appListing.findMany({
    where: { userId: user.id },
    select: { id: true },
  });

  try {
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    console.error("[account] local account deletion failed after Clerk delete", error);
    return {
      ok: false,
      message: "Your sign-in was removed, but local data could not be deleted. Please try again or contact support.",
    };
  }

  invalidatePublicCaches({ profileSlugs: user.profileSlug });
  revalidatePath("/");
  revalidatePath("/browse");
  revalidatePath("/dashboard");
  revalidatePath(profilePath(user.profileSlug));
  for (const listing of listingIds) revalidatePath(appPath(listing.id));

  return { ok: true, message: "Your account, public profile, and listings have been permanently deleted." };
}
