"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth-guards";
import {
  awardBadgesAfterTestCompleted,
  revokeBadgeBelowThreshold,
  syncFirst12Badge,
} from "@/lib/badges";
import { prisma } from "@/lib/db";
import {
  sendNewTesterRequestEmail,
  sendRequestAcceptedEmail,
  sendRequestRejectedEmail,
  sendTestCompletedEmail,
} from "@/lib/email";
import { invalidatePublicCaches } from "@/lib/invalidate-public-caches";
import { appPath, profilePath, TESTING_PERIOD_MS } from "@/lib/mock-data";
import { siteConfig } from "@/lib/site";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

export type RequestState = {
  ok: boolean;
  message: string;
  fieldErrors?: { email?: string };
};

/** Pending tester requests auto-expire after this long (spec: 60 days). */
const REQUEST_TTL_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Tester asks to test an app. Shares their email with the dev.
 * One active request per (listing, tester); re-requesting after a
 * decline/expiry reactivates the existing row.
 */
export async function createTesterRequest(
  listingId: string,
  _prev: RequestState,
  formData: FormData
): Promise<RequestState> {
  const user = await requireDbUser();

  const listing = await prisma.appListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      name: true,
      status: true,
      userId: true,
      user: { select: { clerkId: true, displayName: true, githubUsername: true } },
    },
  });

  if (!listing || listing.status !== "open_for_testing") {
    return { ok: false, message: "This app isn't open for testing right now." };
  }
  if (listing.userId === user.id) {
    return { ok: false, message: "You can't request to test your own app." };
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!isValidEmail(email)) {
    return {
      ok: false,
      message: "Enter a valid email.",
      fieldErrors: { email: "Enter a valid email address." },
    };
  }

  const existing = await prisma.testerRequest.findUnique({
    where: {
      appListingId_testerUserId: {
        appListingId: listing.id,
        testerUserId: user.id,
      },
    },
    select: { status: true },
  });
  if (existing && (existing.status === "pending" || existing.status === "accepted")) {
    return {
      ok: false,
      message:
        existing.status === "accepted"
          ? "You've already been accepted for this app."
          : "You've already requested to test this app.",
    };
  }

  const expiresAt = new Date(Date.now() + REQUEST_TTL_MS);

  try {
    await prisma.testerRequest.upsert({
      where: {
        appListingId_testerUserId: {
          appListingId: listing.id,
          testerUserId: user.id,
        },
      },
      create: {
        appListingId: listing.id,
        testerUserId: user.id,
        testerEmail: email,
        status: "pending",
        expiresAt,
      },
      update: {
        testerEmail: email,
        status: "pending",
        expiresAt,
        testAssignmentId: null,
      },
    });
  } catch (err) {
    console.error("[requests] createTesterRequest failed", err);
    return {
      ok: false,
      message: "Could not submit your request. Try again in a moment.",
    };
  }

  revalidatePath(appPath(listing.id));
  invalidatePublicCaches({
    listingId: listing.id,
    githubUsernames: listing.user.githubUsername,
  });

  void sendNewTesterRequestEmail({
    devClerkId: listing.user.clerkId,
    devName: listing.user.displayName,
    appName: listing.name,
    testerName: user.displayName,
    testerEmail: email,
    listingUrl: `${siteConfig.url}${appPath(listing.id)}`,
  }).catch((err) => {
    console.error("[requests] new-request email failed", err);
  });

  return {
    ok: true,
    message: "Request sent — we'll email you when the developer responds.",
  };
}

/** Owner accepts a pending request. Notifies the tester. */
export async function acceptTesterRequest(requestId: string): Promise<void> {
  await resolveTesterRequest(requestId, "accepted");
}

/** Owner declines a pending request. Notifies the tester. */
export async function rejectTesterRequest(requestId: string): Promise<void> {
  await resolveTesterRequest(requestId, "rejected");
}

/** Shared accept/reject path: ownership + state guard, update, revalidate, notify. */
async function resolveTesterRequest(
  requestId: string,
  outcome: "accepted" | "rejected"
): Promise<void> {
  const user = await requireDbUser();

  const request = await prisma.testerRequest.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      testerEmail: true,
      appListingId: true,
      appListing: {
        select: {
          userId: true,
          name: true,
          user: { select: { githubUsername: true } },
        },
      },
    },
  });

  if (!request || request.appListing.userId !== user.id) {
    return;
  }
  if (request.status !== "pending") {
    return;
  }

  await prisma.testerRequest.update({
    where: { id: requestId },
    data: { status: outcome },
  });

  revalidatePath(appPath(request.appListingId));
  // Reject drops pending count used by browse "most requested" sort.
  invalidatePublicCaches({
    listingId: request.appListingId,
    githubUsernames: request.appListing.user.githubUsername,
  });

  const notify =
    outcome === "accepted"
      ? sendRequestAcceptedEmail({
          testerEmail: request.testerEmail,
          appName: request.appListing.name,
          listingUrl: `${siteConfig.url}${appPath(request.appListingId)}`,
        })
      : sendRequestRejectedEmail({
          testerEmail: request.testerEmail,
          appName: request.appListing.name,
        });
  void notify.catch((err) => {
    console.error(`[requests] ${outcome} email failed`, err);
  });
}

/**
 * Dev confirms an accepted tester has joined the testing track (off-platform
 * Play Store / TestFlight add is done). Creates the TestAssignment, links it
 * to the request, and grants the tester a permanent "Joined" credit.
 * (Spec §4 — Joined credit never decays.)
 */
export async function confirmTesterJoined(requestId: string): Promise<void> {
  const user = await requireDbUser();

  const request = await prisma.testerRequest.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      testerUserId: true,
      testAssignmentId: true,
      appListingId: true,
      tester: { select: { githubUsername: true } },
      appListing: {
        select: {
          userId: true,
          platform: true,
          user: { select: { githubUsername: true } },
        },
      },
    },
  });

  if (!request || request.appListing.userId !== user.id) {
    return;
  }
  if (request.status !== "accepted" || request.testAssignmentId) {
    return;
  }

  // Upsert on the (listing, tester) unique key so a concurrent confirm can't
  // throw a duplicate-key error; the update branch is a no-op.
  const assignment = await prisma.testAssignment.upsert({
    where: {
      appListingId_testerUserId: {
        appListingId: request.appListingId,
        testerUserId: request.testerUserId,
      },
    },
    create: {
      appListingId: request.appListingId,
      testerUserId: request.testerUserId,
      platform: request.appListing.platform,
      joinedAt: new Date(),
      status: "active",
    },
    update: {},
  });

  // Atomically claim the request→assignment link. Only the call that wins the
  // race grants the Joined credit, so it can never be double-counted.
  const { count } = await prisma.testerRequest.updateMany({
    where: { id: requestId, testAssignmentId: null },
    data: { testAssignmentId: assignment.id },
  });
  if (count === 1) {
    await prisma.user.update({
      where: { id: request.testerUserId },
      data: { profileScoreJoined: { increment: 1 } },
    });
  }

  revalidatePath(appPath(request.appListingId));
  invalidatePublicCaches({
    listingId: request.appListingId,
    githubUsernames: [
      request.tester.githubUsername,
      request.appListing.user.githubUsername,
    ],
  });
}

/** Dev marks an active test complete — grants a Completed credit and emails the tester. */
export async function markTestComplete(assignmentId: string): Promise<void> {
  const user = await requireDbUser();
  const assignment = await fetchOwnedAssignment(assignmentId, user.id);
  if (!assignment) {
    return;
  }
  // The platform requirement is 14 complete days. The UI shows the countdown,
  // but keep this guard server-side so a forged action cannot award credit early.
  if (Date.now() - assignment.joinedAt.getTime() < TESTING_PERIOD_MS) {
    return;
  }

  // CAS: only the call that actually flips active→completed grants the credit
  // (and badges / emails), so concurrent submits can't double-count.
  const { count } = await prisma.testAssignment.updateMany({
    where: { id: assignmentId, status: "active" },
    data: { status: "completed", completedAt: new Date() },
  });
  if (count !== 1) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const tester = await tx.user.update({
      where: { id: assignment.testerUserId },
      data: { profileScoreCompleted: { increment: 1 } },
      select: { profileScoreCompleted: true },
    });

    await awardBadgesAfterTestCompleted(tx, {
      developerUserId: assignment.appListing.userId,
      testerUserId: assignment.testerUserId,
      testerCompletedCount: tester.profileScoreCompleted,
      assignmentId,
    });
  });

  revalidatePath(appPath(assignment.appListingId));
  revalidatePath(profilePath(assignment.tester.githubUsername));
  revalidatePath(profilePath(assignment.appListing.user.githubUsername));
  invalidatePublicCaches({
    listingId: assignment.appListingId,
    githubUsernames: [
      assignment.tester.githubUsername,
      assignment.appListing.user.githubUsername,
    ],
  });

  const testerEmail = assignment.testerRequest?.testerEmail;
  if (testerEmail) {
    void sendTestCompletedEmail({
      testerEmail,
      appName: assignment.appListing.name,
      listingUrl: `${siteConfig.url}${appPath(assignment.appListingId)}`,
    }).catch((err) => {
      console.error("[requests] completed email failed", err);
    });
  }
}

/** Dev marks a test incomplete — revokes the Completed credit if one was earned. */
export async function markTestIncomplete(assignmentId: string): Promise<void> {
  const user = await requireDbUser();
  const assignment = await fetchOwnedAssignment(assignmentId, user.id);
  if (!assignment) {
    return;
  }

  // CAS on the prior status so concurrent submits can't double-decrement.
  // The fetched status is the expected value; the update only applies if it
  // still holds.
  if (assignment.status === "completed") {
    const { count } = await prisma.testAssignment.updateMany({
      where: { id: assignmentId, status: "completed" },
      data: { status: "incomplete", completedAt: null },
    });
    if (count === 1) {
      await prisma.$transaction(async (tx) => {
        const tester = await tx.user.update({
          where: { id: assignment.testerUserId },
          data: { profileScoreCompleted: { decrement: 1 } },
          select: { profileScoreCompleted: true },
        });
        await revokeBadgeBelowThreshold(
          tx,
          assignment.testerUserId,
          "super_tester",
          tester.profileScoreCompleted
        );
        await syncFirst12Badge(tx, assignment.appListing.userId);
      });
    }
  } else if (assignment.status === "active") {
    await prisma.testAssignment.updateMany({
      where: { id: assignmentId, status: "active" },
      data: { status: "incomplete", completedAt: null },
    });
  }

  revalidatePath(appPath(assignment.appListingId));
  revalidatePath(profilePath(assignment.tester.githubUsername));
  revalidatePath(profilePath(assignment.appListing.user.githubUsername));
  invalidatePublicCaches({
    listingId: assignment.appListingId,
    githubUsernames: [
      assignment.tester.githubUsername,
      assignment.appListing.user.githubUsername,
    ],
  });
}

/** Fetch an assignment scoped to the calling owner, or null for anyone else. */
async function fetchOwnedAssignment(assignmentId: string, userId: string) {
  const assignment = await prisma.testAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      status: true,
      joinedAt: true,
      testerUserId: true,
      appListingId: true,
      tester: { select: { githubUsername: true } },
      appListing: {
        select: {
          userId: true,
          name: true,
          user: { select: { githubUsername: true } },
        },
      },
      testerRequest: { select: { testerEmail: true } },
    },
  });

  if (!assignment || assignment.appListing.userId !== userId) {
    return null;
  }
  return assignment;
}
