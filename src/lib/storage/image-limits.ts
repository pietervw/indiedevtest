/** CDN cache for uploaded images (deletable — avoid long immutable TTLs).
 * Deleted objects may remain visible in caches for up to max-age (1 hour). */
export const OBJECT_CACHE_CONTROL = "public, max-age=3600";

const SHARED_IMAGE_RULES = {
  maxBytes: 5 * 1024 * 1024,
  minWidth: 320,
  minHeight: 568,
  maxWidth: 4096,
  maxHeight: 4096,
  allowedContentTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
  ] as const,
} as const;

/** App listing screenshots (optional; max 5). */
export const LISTING_IMAGE_LIMITS = {
  ...SHARED_IMAGE_RULES,
  minFiles: 0,
  maxFiles: 5,
} as const;

/** Tester evidence screenshots (required 4–10). */
export const EVIDENCE_IMAGE_LIMITS = {
  ...SHARED_IMAGE_RULES,
  minFiles: 4,
  maxFiles: 10,
} as const;

export type ImageLimits = {
  minFiles: number;
  maxFiles: number;
  maxBytes: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  allowedContentTypes: readonly AllowedImageContentType[];
};

export type AllowedImageContentType =
  (typeof SHARED_IMAGE_RULES.allowedContentTypes)[number];

export function isAllowedImageContentType(
  value: string
): value is AllowedImageContentType {
  return (SHARED_IMAGE_RULES.allowedContentTypes as readonly string[]).includes(
    value
  );
}

export function extensionForContentType(
  contentType: AllowedImageContentType
): "jpg" | "png" | "webp" {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export function validateImageDimensions(
  width: number,
  height: number,
  limits: Pick<
    ImageLimits,
    "minWidth" | "minHeight" | "maxWidth" | "maxHeight"
  > = SHARED_IMAGE_RULES
): string | null {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    return "Could not read image dimensions.";
  }
  if (width < limits.minWidth || height < limits.minHeight) {
    return `Images must be at least ${limits.minWidth}×${limits.minHeight}px.`;
  }
  if (width > limits.maxWidth || height > limits.maxHeight) {
    return `Images must be at most ${limits.maxWidth}×${limits.maxHeight}px.`;
  }
  return null;
}

export function validateImageByteSize(
  byteSize: number,
  maxBytes: number = SHARED_IMAGE_RULES.maxBytes
): string | null {
  if (!Number.isSafeInteger(byteSize) || byteSize < 1) {
    return "Invalid file size.";
  }
  if (byteSize > maxBytes) {
    return `Each image must be ${Math.round(maxBytes / (1024 * 1024))}MB or smaller.`;
  }
  return null;
}
