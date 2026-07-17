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
