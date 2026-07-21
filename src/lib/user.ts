import { Prisma } from "@/generated/prisma";
import { randomUUID } from "crypto";
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
 * Upsert the local User row from the signed-in Clerk session. Clerk's user ID
 * is the primary identity; a linked GitHub account is optional enrichment.
 */
export async function ensureDbUser() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const github = githubAccount(clerkUser.externalAccounts);
    const githubLogin = github?.username ?? null;

    const displayName =
      github?.username ||
      clerkUser.username ||
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      "Indie Dev";

    const imageUrl = clerkUser.imageUrl || null;

    const profileUpdate = {
      displayName,
      imageUrl,
    };

    // Keep githubId when GitHub is linked, but never wipe stored handles if
    // Clerk omits username on this session (legacy /dev/<github> redirects).
    const githubFields = github?.providerUserId
      ? {
          githubId: github.providerUserId,
          ...(githubLogin
            ? { githubUsername: githubLogin, githubLogin }
            : {}),
        }
      : {};

    // Fast path for returning users — no notification.
    const existing = await prisma.user.findUnique({
      where: { clerkId: clerkUser.id },
      select: { id: true },
    });
    if (existing) {
      return await prisma.user.update({
        where: { clerkId: clerkUser.id },
        data: {
          ...profileUpdate,
          ...githubFields,
        },
      });
    }

    // First local profile: only the unique-insert winner may notify (CAS on clerkId).
    try {
      const created = await prisma.user.create({
        data: {
          clerkId: clerkUser.id,
          ...profileUpdate,
          // This is deliberately unrelated to Clerk and GitHub IDs. It is a
          // permanent public URL identifier, even if sign-in methods change.
          profileSlug: `member-${randomUUID()}`,
          githubUsername: githubLogin,
          githubLogin,
          ...(github?.providerUserId ? { githubId: github.providerUserId } : {}),
        },
      });
      void sendFirstUserSignupNotification({
        displayName: created.displayName,
        profileHandle: created.profileSlug,
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

    // Concurrent first-insert race: the other request already created this clerkId.
    const raced = await prisma.user.findUnique({
      where: { clerkId: clerkUser.id },
      select: { id: true },
    });
    if (raced) {
      return await prisma.user.update({
        where: { clerkId: clerkUser.id },
        data: {
          ...profileUpdate,
          ...githubFields,
        },
      });
    }

    // Email-only accounts rely on Clerk's stable user ID and are never
    // auto-linked by email. Without a matching clerkId row, fail closed.
    if (!github?.providerUserId) {
      console.warn("[user] unique conflict for email-only Clerk user", {
        clerkId: clerkUser.id,
      });
      return null;
    }

    // Clerk may present a new Clerk user id after a Clerk migration, instance
    // reset, or account recreation. Rebind the existing local profile by the
    // immutable GitHub provider id rather than treating it as a new user.
    const githubIdentity = await prisma.user.findUnique({
      where: { githubId: github.providerUserId },
      select: { id: true },
    });
    if (githubIdentity) {
      console.info("[user] rebinding local profile to Clerk user", {
        githubId: github.providerUserId,
        clerkId: clerkUser.id,
      });
      return await prisma.user.update({
        where: { id: githubIdentity.id },
        data: {
          ...profileUpdate,
          clerkId: clerkUser.id,
          ...githubFields,
        },
      });
    }

    // Username-only (or other non-githubId) collisions must not auto-link.
    // Fail closed to null — callers treat that as unusable session, not a 500.
    console.warn("[user] unique conflict without matching githubId", {
      githubId: github.providerUserId,
      clerkId: clerkUser.id,
    });
    return null;
  } catch (err) {
    console.error("[user] ensureDbUser failed", err);
    return null;
  }
}
