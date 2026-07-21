"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { invalidateDevProfileCache } from "@/lib/dev-profile";
import { field } from "@/lib/validation";

export type DeleteAccountState = { ok: boolean; message: string };

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
  const listingIds = await prisma.appListing.findMany({
    where: { userId: user.id },
    select: { id: true },
  });

  await prisma.user.delete({ where: { id: user.id } });
  invalidateDevProfileCache(user.profileSlug);
  revalidatePath("/");
  revalidatePath("/browse");
  revalidatePath("/dashboard");
  revalidatePath(`/dev/${user.profileSlug}`);
  for (const listing of listingIds) revalidatePath(`/apps/${listing.id}`);

  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(user.clerkId);
  } catch (error) {
    console.error("[account] local account deleted but Clerk account deletion failed", error);
    return {
      ok: true,
      message: "Your profile and listings have been removed. Please contact support if you need the sign-in account removed too.",
    };
  }

  return { ok: true, message: "Your account, public profile, and listings have been permanently deleted." };
}
