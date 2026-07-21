import "server-only";

import { currentUser } from "@clerk/nextjs/server";

/** Only Clerk-verified addresses may be used for peer-to-peer testing contact. */
export async function getVerifiedClerkEmails(): Promise<string[]> {
  const user = await currentUser();
  if (!user) return [];

  return user.emailAddresses
    .filter((email) => email.verification?.status === "verified")
    .map((email) => email.emailAddress.trim().toLowerCase());
}
