import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

function githubAccount(
  accounts: {
    provider: string;
    providerUserId: string;
    username: string | null;
  }[]
) {
  return accounts.find(
    (account) =>
      account.provider === "oauth_github" || account.provider === "github"
  );
}

/**
 * Upsert the local User row from the signed-in Clerk session (GitHub OAuth).
 * Returns null when signed out, GitHub is not linked, or the DB is unavailable.
 */
export async function ensureDbUser() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const github = githubAccount(clerkUser.externalAccounts);
    if (!github?.providerUserId) {
      console.warn("[user] signed in without a linked GitHub account", {
        clerkId: clerkUser.id,
      });
      return null;
    }

    const githubUsername =
      github.username ||
      clerkUser.username ||
      `gh-${github.providerUserId}`;

    const displayName =
      github.username ||
      clerkUser.username ||
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      "Indie Dev";

    const imageUrl = clerkUser.imageUrl || null;

    return await prisma.user.upsert({
      where: { clerkId: clerkUser.id },
      create: {
        clerkId: clerkUser.id,
        githubId: github.providerUserId,
        githubUsername,
        displayName,
        imageUrl,
      },
      update: {
        displayName,
        githubId: github.providerUserId,
        githubUsername,
        imageUrl,
      },
    });
  } catch (err) {
    console.error("[user] ensureDbUser failed", err);
    return null;
  }
}
