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
import {
  expirePendingTesterRequests,
  TESTER_REQUEST_TTL_MS,
} from "@/lib/expire-pending-tester-requests";
import { invalidatePublicCaches } from "@/lib/invalidate-public-caches";
import { appPath, profilePath, TESTING_PERIOD_MS } from "@/lib/mock-data";
import { takeRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { siteConfig } from "@/lib/site";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

export type RequestState = {
  ok: boolean;
  message: string;
  fieldErrors?: { email?: string };
};

export type ResendInvitationState = {
  ok: boolean;
  message: string;
};

function revalidateListingActivity(listingId: string) {
  revalidatePath(appPath(listingId));
  revalidatePath("/dashboard");
}

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

  // Lazy-expire this tester's overdue pending row so re-request is allowed.
  await expirePendingTesterRequests({
    listingId: listing.id,
    testerUserId: user.id,
  });

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

  // A small per-user guard stops an account from mass-emailing listing owners.
  // Check first; only consume a slot after the DB write succeeds.
  const requestLimit = checkRateLimit({
    key: `tester-request:${user.id}`,
    limit: 6,
    windowMs: 60 * 60 * 1000,
  });
  if (!requestLimit.allowed) {
    const minutes = Math.max(1, Math.ceil(requestLimit.retryAfterSeconds / 60));
    return {
      ok: false,
      message: `You've sent several requests recently. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const expiresAt = new Date(Date.now() + TESTER_REQUEST_TTL_MS);

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

  takeRateLimit({
    key: `tester-request:${user.id}`,
    limit: 6,
    windowMs: 60 * 60 * 1000,
  });

  revalidateListingActivity(listing.id);
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

/** Tester withdraws before joining; reuses expired so they can request again. */
export async function withdrawTesterRequest(
  listingId: string,
  expectedStatus: "pending" | "accepted" = "pending"
): Promise<void> {
  const user = await requireDbUser();

  const request = await prisma.testerRequest.findUnique({
    where: {
      appListingId_testerUserId: { appListingId: listingId, testerUserId: user.id },
    },
    select: {
      id: true,
      appListing: { select: { user: { select: { githubUsername: true } } } },
    },
  });
  if (!request) return;

  // CAS on the UI's expected status so a stale "pending" view cannot expire an
  // already-accepted request (and vice versa).
  const { count } = await prisma.testerRequest.updateMany({
    where: {
      id: request.id,
      status: expectedStatus,
      testAssignmentId: null,
    },
    data: { status: "expired" },
  });
  if (count !== 1) return;

  revalidateListingActivity(listingId);
  invalidatePublicCaches({
    listingId,
    githubUsernames: [user.githubUsername, request.appListing.user.githubUsername],
  });
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
      testerEmail: true,
      appListingId: true,
      appListing: {
        select: {
          userId: true,
          name: true,
          testingAccessUrl: true,
          testerInstructions: true,
          user: { select: { githubUsername: true } },
        },
      },
    },
  });

  if (!request || request.appListing.userId !== user.id) {
    return;
  }

  // Expire overdue pendings on this listing (status/cache hygiene).
  await expirePendingTesterRequests({ listingId: request.appListingId });

  // CAS: only transition still-pending, not-yet-expired rows.
  const { count } = await prisma.testerRequest.updateMany({
    // Recheck expiresAt so accept cannot win a race with lazy expiry.
    where: {
      id: requestId,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    data: { status: outcome },
  });
  if (count !== 1) {
    return;
  }

  revalidateListingActivity(request.appListingId);
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
          testingAccessUrl: request.appListing.testingAccessUrl,
          testerInstructions: request.appListing.testerInstructions,
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
 * Owner may resend the saved private invitation to an accepted tester. This is
 * intentionally one tester at a time; a small rate limit prevents accidental
 * or abusive repeat sends without adding an outbound-email queue to the MVP.
 */
export async function resendTesterInvitation(
  requestId: string,
  _prev: ResendInvitationState,
  _formData: FormData
): Promise<ResendInvitationState> {
  // useActionState supplies these arguments even though this mutation has no
  // form fields and its response is only the delivery status.
  void _prev;
  void _formData;
  const user = await requireDbUser();
  const request = await prisma.testerRequest.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      testAssignmentId: true,
      testerEmail: true,
      appListingId: true,
      appListing: {
        select: {
          userId: true,
          name: true,
          testingAccessUrl: true,
          testerInstructions: true,
        },
      },
    },
  });

  if (
    !request ||
    request.appListing.userId !== user.id ||
    request.status !== "accepted" ||
    request.testAssignmentId !== null
  ) {
    return { ok: false, message: "That tester is no longer awaiting an invitation." };
  }
  if (!request.appListing.testingAccessUrl && !request.appListing.testerInstructions) {
    return {
      ok: false,
      message: "Add a testing link or instructions before sending an invitation.",
    };
  }

  const limit = checkRateLimit({
    key: `tester-invitation:${user.id}`,
    limit: 6,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
    return {
      ok: false,
      message: `You've resent several invitations recently. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  // Consume before the external send to make concurrent clicks harmless.
  takeRateLimit({
    key: `tester-invitation:${user.id}`,
    limit: 6,
    windowMs: 60 * 60 * 1000,
  });
  try {
    await sendRequestAcceptedEmail({
      testerEmail: request.testerEmail,
      appName: request.appListing.name,
      listingUrl: `${siteConfig.url}${appPath(request.appListingId)}`,
      testingAccessUrl: request.appListing.testingAccessUrl,
      testerInstructions: request.appListing.testerInstructions,
    });
    return { ok: true, message: "Invitation resent." };
  } catch (err) {
    console.error("[requests] resend invitation email failed", err);
    return { ok: false, message: "Could not resend the invitation. Try again shortly." };
  }
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

  revalidateListingActivity(request.appListingId);
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
  // Play closed-testing requires 14 complete days. iOS/TestFlight has no
  // equivalent — only enforce the delay for Android assignments.
  if (
    assignment.platform === "android" &&
    Date.now() - assignment.joinedAt.getTime() < TESTING_PERIOD_MS
  ) {
    return;
  }

  // CAS + score/badges in one transaction so a mid-flight failure cannot leave
  // status flipped without the matching credit/badge effects.
  const awarded = await prisma.$transaction(async (tx) => {
    const { count } = await tx.testAssignment.updateMany({
      where: { id: assignmentId, status: "active" },
      data: { status: "completed", completedAt: new Date() },
    });
    if (count !== 1) {
      return false;
    }

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
    return true;
  });
  if (!awarded) {
    return;
  }

  revalidateListingActivity(assignment.appListingId);
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
  if (assignment.status === "completed") {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.testAssignment.updateMany({
        where: { id: assignmentId, status: "completed" },
        data: { status: "incomplete", completedAt: null },
      });
      if (count !== 1) {
        return;
      }

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
  } else if (assignment.status === "active") {
    await prisma.testAssignment.updateMany({
      where: { id: assignmentId, status: "active" },
      data: { status: "incomplete", completedAt: null },
    });
  }

  revalidateListingActivity(assignment.appListingId);
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
      platform: true,
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
