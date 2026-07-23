import { EVIDENCE_IMAGE_LIMITS } from "@/lib/storage/image-limits";

export const MIN_IMPROVEMENT_LENGTH = 10;
export const MAX_IMPROVEMENT_LENGTH = 500;

export function isCompleteEvidence(options: {
  improvementSuggestion: string;
  screenshotCount: number;
}): boolean {
  return (
    options.improvementSuggestion.trim().length >= MIN_IMPROVEMENT_LENGTH &&
    options.screenshotCount >= EVIDENCE_IMAGE_LIMITS.minFiles
  );
}
