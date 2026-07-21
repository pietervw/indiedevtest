"use server";

import { revalidatePath } from "next/cache";
import {
  ListingModerationStatus,
  ListingReportReason,
  ListingReportStatus,
} from "@/generated/prisma";
import { requireAdmin, requireDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { invalidatePublicCaches } from "@/lib/invalidate-public-caches";
import { appPath } from "@/lib/mock-data";
import { sendListingReportNotification } from "@/lib/pushover";
import { checkRateLimit, takeRateLimit } from "@/lib/rate-limit";
import { listingReportReasonLabels } from "@/lib/listing-reports";
import { siteConfig } from "@/lib/site";

const REPORT_REASONS = new Set<string>(Object.values(ListingReportReason));

export type ListingReportState = { ok: boolean; message: string };

export async function createListingReport(
  listingId: string,
  _prev: ListingReportState,
  formData: FormData
): Promise<ListingReportState> {
  void _prev;
  const user = await requireDbUser();
  const reason = String(formData.get("reason") ?? "");
  const details = String(formData.get("details") ?? "").trim();

  if (!REPORT_REASONS.has(reason)) {
    return { ok: false, message: "Choose a reason for this report." };
  }
  if (details.length > 1_000) {
    return { ok: false, message: "Details must be 1,000 characters or fewer." };
  }

  const limit = checkRateLimit({
    key: `listing-report:${user.id}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return {
      ok: false,
      message: "You've sent several reports recently. Please try again later.",
    };
  }

  const listing = await prisma.appListing.findFirst({
    where: { id: listingId, moderationStatus: "visible" },
    select: { id: true, name: true, userId: true },
  });
  if (!listing) {
    return { ok: false, message: "This listing is no longer available to report." };
  }
  if (listing.userId === user.id) {
    return { ok: false, message: "You can't report your own listing." };
  }

  try {
    await prisma.listingReport.create({
      data: {
        appListingId: listing.id,
        reporterId: user.id,
        reason: reason as ListingReportReason,
        details: details || null,
      },
    });
  } catch (error) {
    // The partial unique index is the final concurrency-safe guard.
    const isDuplicate =
      typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
    if (isDuplicate) {
      return { ok: false, message: "You already have an open report for this listing." };
    }
    console.error("[listing-reports] create failed", error);
    return { ok: false, message: "We couldn't submit this report. Please try again." };
  }

  takeRateLimit({ key: `listing-report:${user.id}`, limit: 5, windowMs: 60 * 60 * 1000 });
  void sendListingReportNotification({
    appName: listing.name,
    reason: listingReportReasonLabels[reason as ListingReportReason],
    listingUrl: `${siteConfig.url}/admin/reports`,
  });
  return { ok: true, message: "Thanks — your report has been sent to the site admin." };
}

export async function resolveListingReport(
  reportId: string,
  action: "dismiss" | "hide" | "remove"
): Promise<void> {
  const admin = await requireAdmin();
  if (!new Set(["dismiss", "hide", "remove"]).has(action)) {
    return;
  }
  const report = await prisma.listingReport.findUnique({
    where: { id: reportId },
    select: { id: true, appListingId: true, status: true },
  });
  if (!report || report.status !== ListingReportStatus.open) return;

  const moderationStatus: ListingModerationStatus | null =
    action === "hide" ? ListingModerationStatus.hidden :
    action === "remove" ? ListingModerationStatus.removed : null;

  await prisma.$transaction([
    prisma.listingReport.update({
      where: { id: report.id },
      data: {
        status: ListingReportStatus.dismissed,
        resolvedAt: new Date(),
        resolvedById: admin.id,
      },
    }),
    ...(moderationStatus
      ? [
          prisma.appListing.update({
            where: { id: report.appListingId },
            data: { moderationStatus },
          }),
        ]
      : []),
  ]);

  revalidatePath("/admin/reports");
  revalidatePath(appPath(report.appListingId));
  invalidatePublicCaches({ listingId: report.appListingId });
}

/** Restore a temporarily hidden listing after an admin review. */
export async function restoreListingVisibility(listingId: string): Promise<void> {
  await requireAdmin();
  const { count } = await prisma.appListing.updateMany({
    where: { id: listingId, moderationStatus: ListingModerationStatus.hidden },
    data: { moderationStatus: ListingModerationStatus.visible },
  });
  if (count !== 1) return;

  revalidatePath("/admin/reports");
  revalidatePath(appPath(listingId));
  invalidatePublicCaches({ listingId });
}
