import { EVIDENCE_IMAGE_LIMITS } from "@/lib/storage/image-limits";

export const MIN_IMPROVEMENT_LENGTH = 10;
export const MAX_IMPROVEMENT_LENGTH = 500;

export function isCompleteEvidence(options: {
  improvementSuggestion: string;
  screenshotCount: number;
}): boolean {
  const suggestionLength = options.improvementSuggestion.trim().length;
  return (
    suggestionLength >= MIN_IMPROVEMENT_LENGTH &&
    suggestionLength <= MAX_IMPROVEMENT_LENGTH &&
    options.screenshotCount >= EVIDENCE_IMAGE_LIMITS.minFiles
  );
}
