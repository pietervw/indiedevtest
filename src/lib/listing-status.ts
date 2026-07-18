import type { AppListingStatus } from "@/generated/prisma";
import { statusLabel } from "@/lib/mock-data";

/**
 * Spec flow: Draft → Open for Testing → Closed for Testing (optional)
 * → Testing Complete → Launched
 * Closed may be skipped (open → testing_complete).
 */
export const STATUS_TRANSITIONS: Record<
  AppListingStatus,
  AppListingStatus[]
> = {
  draft: ["draft", "open_for_testing"],
  open_for_testing: [
    "open_for_testing",
    "closed_for_testing",
    "testing_complete",
  ],
  closed_for_testing: ["closed_for_testing", "testing_complete"],
  testing_complete: ["testing_complete", "launched"],
  launched: ["launched"],
};

export function allowedStatusesFrom(
  current: AppListingStatus
): AppListingStatus[] {
  return STATUS_TRANSITIONS[current] ?? [current];
}

export function isAllowedStatusTransition(
  from: AppListingStatus,
  to: AppListingStatus
): boolean {
  return allowedStatusesFrom(from).includes(to);
}

export function statusOptionsFor(current: AppListingStatus) {
  return allowedStatusesFrom(current).map((value) => ({
    value,
    label: statusLabel[value] ?? value,
  }));
}

export const PUBLIC_LISTING_STATUSES = [
  "open_for_testing",
  "closed_for_testing",
  "testing_complete",
  "launched",
] as const satisfies readonly AppListingStatus[];

/** Listings that can receive reviews on their public wall. */
export const REVIEWABLE_LISTING_STATUSES = [
  "open_for_testing",
  "closed_for_testing",
] as const satisfies readonly AppListingStatus[];

/** Assignments that count toward tester slots / review eligibility. */
export const COUNTED_ASSIGNMENT_STATUSES = ["active", "completed"] as const;

export function isPublicListingStatus(status: AppListingStatus): boolean {
  return (PUBLIC_LISTING_STATUSES as readonly AppListingStatus[]).includes(
    status
  );
}

export function isReviewableListingStatus(status: AppListingStatus): boolean {
  return (REVIEWABLE_LISTING_STATUSES as readonly AppListingStatus[]).includes(
    status
  );
}

/** Type guard for {@link COUNTED_ASSIGNMENT_STATUSES} (also narrows the enum). */
export function isCountedAssignmentStatus(
  status: string
): status is (typeof COUNTED_ASSIGNMENT_STATUSES)[number] {
  return (COUNTED_ASSIGNMENT_STATUSES as readonly string[]).includes(status);
}
