import type { ListingReportReason } from "@/generated/prisma";

/** Human-readable labels shared by the report form, admin queue, and alerts. */
export const listingReportReasonLabels: Record<ListingReportReason, string> = {
  spam_or_scam: "Spam or scam",
  inappropriate_content: "Inappropriate content",
  broken_or_misleading_link: "Broken or misleading testing link",
  impersonation: "Impersonation",
  other: "Other",
};
