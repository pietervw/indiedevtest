import { ensureDbUser } from "@/lib/user";

/** Syncs the Clerk session into the local User table (no UI). */
export async function EnsureUser() {
  await ensureDbUser();
  return null;
}
