"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth-guards";
import {
  awardBadgesAfterTestCompleted,
  revokeBadgeBelowThreshold,
  syncFirst12Badge,
} from "@/lib/badges";
import { prisma } from "@/lib/db";
import { TesterActivityType } from "@/generated/prisma";
import {
  sendNewTesterRequestEmail,
  sendRequestAcceptedEmail,
  sendRequestRejectedEmail,
  sendTestCompletedEmail,
  sendTesterWithdrawalEmail,
} from "@/lib/email";
import {
  expirePendingTesterRequests,
  TESTER_REQUEST_TTL_MS,
} from "@/lib/expire-pending-tester-requests";
import { invalidatePublicCaches } from "@/lib/invalidate-public-caches";
import { appPath, profilePath, TESTING_PERIOD_MS } from "@/lib/mock-data";
import { takeRateLimit, checkRateLimit, releaseRateLimit } from "@/lib/rate-limit";
import { siteConfig } from "@/lib/site";
import { getVerifiedClerkEmails } from "@/lib/verified-clerk-emails";
import { sendTesterRequestNotification } from "@/lib/pushover";

export type RequestState = {
  ok: boolean;
  message: string;
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
 * Tester asks to test an app. Their saved profile email is shared with the dev.
 * One active request per (listing, tester); re-requesting after a
 * decline/expiry reactivates the existing row.
 */
export async function createTesterRequest(
  listingId: string,
  _prev: RequestState,
  formData: FormData
): Promise<RequestState> {
  // The saved profile address is authoritative; this button has no fields.
  void _prev;
  void formData;
  const user = await requireDbUser();

  const listing = await prisma.appListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      name: true,
      status: true,
      testerCapacity: true,
      userId: true,
      user: { select: { clerkId: true, displayName: true, profileSlug: true } },
    },
  });

  if (!listing || listing.status !== "open_for_testing") {
    return { ok: false, message: "This app isn't open for testing right now." };
  }
  if (listing.userId === user.id) {
    return { ok: false, message: "You can't request to test your own app." };
  }

  const email = user.contactEmail;
  if (!email) {
    return {
      ok: false,
      message: "Add your testing contact email in your profile before requesting a test.",
    };
  }
  // Profiles created before verified-email enforcement may still have an old
  // arbitrary value saved. Never share it with a developer unless Clerk still
  // confirms ownership at the moment the request is submitted.
  const verifiedEmails = await getVerifiedClerkEmails();
  if (!verifiedEmails.includes(email.trim().toLowerCase())) {
    return {
      ok: false,
      message:
        "Choose a verified testing contact email in Profile settings before requesting a test.",
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

  let requestId: string | null = null;
  let acceptedCapacityFull = false;
  try {
    const result = await prisma.$transaction(async (tx) => {
      // The acceptance action takes this same row lock. This prevents a
      // request from being queued against a program that has just filled.
      await tx.$executeRaw`SELECT 1 FROM app_listings WHERE id = ${listing.id} FOR UPDATE`;
      const currentListing = await tx.appListing.findUnique({
        where: { id: listing.id },
        select: { status: true, testerCapacity: true },
      });
      if (!currentListing || currentListing.status !== "open_for_testing") {
        return { full: true, requestId: null };
      }
      if (currentListing.testerCapacity !== null) {
        const acceptedCount = await tx.testerRequest.count({
          where: { appListingId: listing.id, status: "accepted" },
        });
        if (acceptedCount >= currentListing.testerCapacity) {
          await tx.appListing.update({
            where: { id: listing.id },
            data: { status: "closed_for_testing", autoClosedForCapacity: true },
          });
          return { full: true, requestId: null };
        }
      }
      const testerRequest = await tx.testerRequest.upsert({
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
      return { full: false, requestId: testerRequest.id };
    });
    acceptedCapacityFull = result.full;
    requestId = result.requestId;
  } catch (err) {
    console.error("[requests] createTesterRequest failed", err);
    return {
      ok: false,
      message: "Could not submit your request. Try again in a moment.",
    };
  }
  if (acceptedCapacityFull) {
    revalidateListingActivity(listing.id);
    invalidatePublicCaches({
      listingId: listing.id,
      profileSlugs: listing.user.profileSlug,
    });
    return {
      ok: false,
      message: "This program has filled all of its tester places.",
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
    profileSlugs: listing.user.profileSlug,
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
  await recordTesterActivity({
    requestId: requestId!,
    listingId: listing.id,
    testerUserId: user.id,
    type: TesterActivityType.requested,
  });
  void sendTesterRequestNotification({
    appName: listing.name,
    testerName: user.displayName,
    listingUrl: `${siteConfig.url}${appPath(listing.id)}`,
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

/** Owner can undo a decline and return the request to their pending queue. */
export async function undoTesterRequestDecline(requestId: string): Promise<void> {
  const user = await requireDbUser();
  const request = await prisma.testerRequest.findUnique({
    where: { id: requestId },
    select: {
      testerUserId: true,
      appListingId: true,
      appListing: { select: { userId: true, user: { select: { profileSlug: true } } } },
    },
  });
  if (!request || request.appListing.userId !== user.id) return;

  const { count } = await prisma.testerRequest.updateMany({
    where: { id: requestId, status: "rejected", testAssignmentId: null },
    data: {
      status: "pending",
      expiresAt: new Date(Date.now() + TESTER_REQUEST_TTL_MS),
    },
  });
  if (count !== 1) return;

  await recordTesterActivity({
    requestId,
    listingId: request.appListingId,
    testerUserId: request.testerUserId,
    type: TesterActivityType.decline_reversed,
  });
  revalidateListingActivity(request.appListingId);
  invalidatePublicCaches({
    listingId: request.appListingId,
    profileSlugs: request.appListing.user.profileSlug,
  });
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
      appListing: {
        select: {
          name: true,
          user: {
            select: {
              clerkId: true,
              displayName: true,
              profileSlug: true,
            },
          },
        },
      },
    },
  });
  if (!request) return;

  // CAS on the UI's expected status so a stale "pending" view cannot expire an
  // already-accepted request (and vice versa).
  const withdrew = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM app_listings WHERE id = ${listingId} FOR UPDATE`;
    const { count } = await tx.testerRequest.updateMany({
      where: {
        id: request.id,
        status: expectedStatus,
        testAssignmentId: null,
      },
      data: { status: "expired", withdrawnAt: new Date() },
    });
    if (count !== 1) return false;

    const listing = await tx.appListing.findUnique({
      where: { id: listingId },
      select: { testerCapacity: true, autoClosedForCapacity: true },
    });
    if (listing?.autoClosedForCapacity && listing.testerCapacity !== null) {
      const acceptedCount = await tx.testerRequest.count({
        where: { appListingId: listingId, status: "accepted" },
      });
      if (acceptedCount < listing.testerCapacity) {
        await tx.appListing.update({
          where: { id: listingId },
          data: { status: "open_for_testing", autoClosedForCapacity: false },
        });
      }
    }
    return true;
  });
  if (!withdrew) return;

  await recordTesterActivity({
    requestId: request.id,
    listingId,
    testerUserId: user.id,
    type: TesterActivityType.withdrew,
  });

  revalidateListingActivity(listingId);
  invalidatePublicCaches({
    listingId,
    profileSlugs: [user.profileSlug, request.appListing.user.profileSlug],
  });

  void sendTesterWithdrawalEmail({
    devClerkId: request.appListing.user.clerkId,
    devName: request.appListing.user.displayName,
    appName: request.appListing.name,
    testerName: user.displayName,
    listingUrl: `${siteConfig.url}${appPath(listingId)}`,
  }).catch((err) => {
    console.error("[requests] withdrawal email failed", err);
  });
}

async function recordTesterActivity(input: {
  requestId: string;
  listingId: string;
  testerUserId: string;
  type: TesterActivityType;
}) {
  await prisma.testerActivity.create({
    data: {
      testerRequestId: input.requestId,
      appListingId: input.listingId,
      testerUserId: input.testerUserId,
      type: input.type,
    },
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
      testerUserId: true,
      appListingId: true,
      appListing: {
        select: {
          userId: true,
          name: true,
          status: true,
          testerCapacity: true,
          testingAccessUrl: true,
          testerInstructions: true,
          user: { select: { profileSlug: true, contactEmail: true } },
        },
      },
    },
  });

  if (!request || request.appListing.userId !== user.id) {
    return;
  }

  // Expire overdue pendings on this listing (status/cache hygiene).
  await expirePendingTesterRequests({ listingId: request.appListingId });

  let updated = false;
  let capacityClosed = false;

  if (outcome === "accepted") {
    // Serialize capacity checks against concurrent approvals for the same
    // listing. A slot is consumed at acceptance (not join) so invitations
    // cannot overbook a capped testing program.
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM app_listings WHERE id = ${request.appListingId} FOR UPDATE`;
      const listing = await tx.appListing.findUnique({
        where: { id: request.appListingId },
        select: { status: true, testerCapacity: true },
      });
      if (!listing || listing.status !== "open_for_testing") {
        return { updated: false, capacityClosed: false };
      }

      const acceptedCount = await tx.testerRequest.count({
        where: { appListingId: request.appListingId, status: "accepted" },
      });
      if (listing.testerCapacity !== null && acceptedCount >= listing.testerCapacity) {
        await tx.appListing.updateMany({
          where: { id: request.appListingId, status: "open_for_testing" },
          data: { status: "closed_for_testing", autoClosedForCapacity: true },
        });
        return { updated: false, capacityClosed: true };
      }

      const { count } = await tx.testerRequest.updateMany({
        where: {
          id: requestId,
          status: "pending",
          expiresAt: { gt: new Date() },
        },
        data: { status: "accepted" },
      });
      if (count !== 1) return { updated: false, capacityClosed: false };

      const capacityFilled =
        listing.testerCapacity !== null && acceptedCount + 1 >= listing.testerCapacity;
      if (capacityFilled) {
        await tx.appListing.update({
          where: { id: request.appListingId },
          data: { status: "closed_for_testing", autoClosedForCapacity: true },
        });
      }
      return { updated: true, capacityClosed: capacityFilled };
    });
    updated = result.updated;
    capacityClosed = result.capacityClosed;
  } else {
    const { count } = await prisma.testerRequest.updateMany({
      // Recheck expiresAt so reject cannot win a race with lazy expiry.
      where: {
        id: requestId,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
      data: { status: "rejected" },
    });
    updated = count === 1;
  }
  if (!updated && !capacityClosed) {
    return;
  }

  if (updated) {
    await recordTesterActivity({
      requestId,
      listingId: request.appListingId,
      testerUserId: request.testerUserId,
      type:
        outcome === "accepted"
          ? TesterActivityType.approved
          : TesterActivityType.declined,
    });
  }

  revalidateListingActivity(request.appListingId);
  // Reject drops pending count used by browse "most requested" sort.
  invalidatePublicCaches({
    listingId: request.appListingId,
    profileSlugs: request.appListing.user.profileSlug,
  });

  const notify =
    outcome === "accepted" && updated
      ? sendRequestAcceptedEmail({
          testerEmail: request.testerEmail,
          appName: request.appListing.name,
          listingUrl: `${siteConfig.url}${appPath(request.appListingId)}`,
          developerContactEmail: request.appListing.user.contactEmail,
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
      testerUserId: true,
      testerEmail: true,
      appListingId: true,
      appListing: {
        select: {
          userId: true,
          name: true,
          testingAccessUrl: true,
          testerInstructions: true,
          user: { select: { contactEmail: true } },
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
  if (
    !request.appListing.testingAccessUrl &&
    !request.appListing.testerInstructions &&
    !request.appListing.user.contactEmail
  ) {
    return {
      ok: false,
      message:
        "Add a testing link, instructions, or a contact email before sending an invitation.",
    };
  }

  const invitationLimitKey = `tester-invitation:${user.id}`;
  const limit = takeRateLimit({
    key: invitationLimitKey,
    limit: 6,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed || !limit.reservation) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
    return {
      ok: false,
      message: `You've resent several invitations recently. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  try {
    await sendRequestAcceptedEmail({
      testerEmail: request.testerEmail,
      appName: request.appListing.name,
      listingUrl: `${siteConfig.url}${appPath(request.appListingId)}`,
      developerContactEmail: request.appListing.user.contactEmail,
      testingAccessUrl: request.appListing.testingAccessUrl,
      testerInstructions: request.appListing.testerInstructions,
    });
  } catch (err) {
    releaseRateLimit(limit.reservation);
    console.error("[requests] resend invitation email failed", err);
    return { ok: false, message: "Could not resend the invitation. Try again shortly." };
  }

  await recordTesterActivity({
    requestId,
    listingId: request.appListingId,
    testerUserId: request.testerUserId,
    type: TesterActivityType.invitation_resent,
  });

  return { ok: true, message: "Invitation resent." };
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
      tester: { select: { profileSlug: true } },
      appListing: {
        select: {
          userId: true,
          platform: true,
          user: { select: { profileSlug: true } },
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
    await recordTesterActivity({
      requestId,
      listingId: request.appListingId,
      testerUserId: request.testerUserId,
      type: TesterActivityType.joined,
    });
  }

  revalidateListingActivity(request.appListingId);
  invalidatePublicCaches({
    listingId: request.appListingId,
    profileSlugs: [
      request.tester.profileSlug,
      request.appListing.user.profileSlug,
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

  if (assignment.testerRequest?.id) {
    await recordTesterActivity({
      requestId: assignment.testerRequest.id,
      listingId: assignment.appListingId,
      testerUserId: assignment.testerUserId,
      type: TesterActivityType.completed,
    });
  }

  revalidateListingActivity(assignment.appListingId);
  revalidatePath(profilePath(assignment.tester.profileSlug));
  revalidatePath(profilePath(assignment.appListing.user.profileSlug));
  invalidatePublicCaches({
    listingId: assignment.appListingId,
    profileSlugs: [
      assignment.tester.profileSlug,
      assignment.appListing.user.profileSlug,
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
  revalidatePath(profilePath(assignment.tester.profileSlug));
  revalidatePath(profilePath(assignment.appListing.user.profileSlug));
  invalidatePublicCaches({
    listingId: assignment.appListingId,
    profileSlugs: [
      assignment.tester.profileSlug,
      assignment.appListing.user.profileSlug,
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
      tester: { select: { profileSlug: true } },
      appListing: {
        select: {
          userId: true,
          name: true,
          user: { select: { profileSlug: true } },
        },
      },
      testerRequest: { select: { id: true, testerEmail: true } },
    },
  });

  if (!assignment || assignment.appListing.userId !== userId) {
    return null;
  }
  return assignment;
}
