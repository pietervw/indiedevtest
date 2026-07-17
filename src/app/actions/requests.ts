"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import {
  sendNewTesterRequestEmail,
  sendRequestAcceptedEmail,
  sendRequestRejectedEmail,
} from "@/lib/email";
import { appPath } from "@/lib/mock-data";
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
      user: { select: { clerkId: true, displayName: true } },
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
  const user = await requireDbUser();

  const request = await prisma.testerRequest.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      testerEmail: true,
      appListingId: true,
      appListing: { select: { userId: true, name: true } },
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
    data: { status: "accepted" },
  });

  revalidatePath(appPath(request.appListingId));

  void sendRequestAcceptedEmail({
    testerEmail: request.testerEmail,
    appName: request.appListing.name,
    listingUrl: `${siteConfig.url}${appPath(request.appListingId)}`,
  }).catch((err) => {
    console.error("[requests] accepted email failed", err);
  });
}

/** Owner declines a pending request. Notifies the tester. */
export async function rejectTesterRequest(requestId: string): Promise<void> {
  const user = await requireDbUser();

  const request = await prisma.testerRequest.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      testerEmail: true,
      appListingId: true,
      appListing: { select: { userId: true, name: true } },
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
    data: { status: "rejected" },
  });

  revalidatePath(appPath(request.appListingId));

  void sendRequestRejectedEmail({
    testerEmail: request.testerEmail,
    appName: request.appListing.name,
  }).catch((err) => {
    console.error("[requests] rejected email failed", err);
  });
}
