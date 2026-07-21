import { Prisma } from "@/generated/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { sendFirstUserSignupNotification } from "@/lib/pushover";

function githubAccount(
  accounts: {
    provider: string;
    providerUserId: string;
    username: string | null;
  }[]
) {
  return accounts.find((account) =>
    account.provider.toLowerCase().includes("github")
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
        providers: clerkUser.externalAccounts.map((account) => account.provider),
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

    const profileUpdate = {
      displayName,
      githubId: github.providerUserId,
      githubUsername,
      imageUrl,
    };

    // Fast path for returning users — no notification.
    const existing = await prisma.user.findUnique({
      where: { clerkId: clerkUser.id },
      select: { id: true },
    });
    if (existing) {
      return await prisma.user.update({
        where: { clerkId: clerkUser.id },
        data: profileUpdate,
      });
    }

    // First local profile: only the unique-insert winner may notify (CAS on clerkId).
    try {
      const created = await prisma.user.create({
        data: {
          clerkId: clerkUser.id,
          ...profileUpdate,
        },
      });
      void sendFirstUserSignupNotification({
        displayName: created.displayName,
        githubUsername: created.githubUsername,
      });
      return created;
    } catch (err) {
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError) ||
        err.code !== "P2002"
      ) {
        throw err;
      }
    }

    return await prisma.user.update({
      where: { clerkId: clerkUser.id },
      data: profileUpdate,
    });
  } catch (err) {
    console.error("[user] ensureDbUser failed", err);
    return null;
  }
}
