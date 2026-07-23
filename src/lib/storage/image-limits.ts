/** CDN cache for listing screenshots (deletable — avoid long immutable TTLs).
 * Deleted objects may remain visible in caches for up to max-age (1 hour). */
export const OBJECT_CACHE_CONTROL = "public, max-age=3600";

export const IMAGE_LIMITS = {
  maxFiles: 5,
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

export type AllowedImageContentType =
  (typeof IMAGE_LIMITS.allowedContentTypes)[number];

export function isAllowedImageContentType(
  value: string
): value is AllowedImageContentType {
  return (IMAGE_LIMITS.allowedContentTypes as readonly string[]).includes(
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
  height: number
): string | null {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    return "Could not read image dimensions.";
  }
  if (width < IMAGE_LIMITS.minWidth || height < IMAGE_LIMITS.minHeight) {
    return `Images must be at least ${IMAGE_LIMITS.minWidth}×${IMAGE_LIMITS.minHeight}px.`;
  }
  if (width > IMAGE_LIMITS.maxWidth || height > IMAGE_LIMITS.maxHeight) {
    return `Images must be at most ${IMAGE_LIMITS.maxWidth}×${IMAGE_LIMITS.maxHeight}px.`;
  }
  return null;
}

export function validateImageByteSize(byteSize: number): string | null {
  if (!Number.isSafeInteger(byteSize) || byteSize < 1) {
    return "Invalid file size.";
  }
  if (byteSize > IMAGE_LIMITS.maxBytes) {
    return `Each image must be ${Math.round(IMAGE_LIMITS.maxBytes / (1024 * 1024))}MB or smaller.`;
  }
  return null;
}
