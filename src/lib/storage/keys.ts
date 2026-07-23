import { randomUUID } from "crypto";
import {
  extensionForContentType,
  type AllowedImageContentType,
} from "@/lib/storage/image-limits";
import { STORAGE_FOLDERS } from "@/lib/storage/env";

/** Temporary upload target: listings/{listingId}/tmp/{uuid}.{ext} */
export function listingScreenshotPendingObjectKey(
  listingId: string,
  contentType: AllowedImageContentType
): string {
  const ext = extensionForContentType(contentType);
  return `${STORAGE_FOLDERS.listings}/${listingId}/tmp/${randomUUID()}.${ext}`;
}

/** Promote tmp key → immutable public key (strip `/tmp/`). */
export function finalKeyFromPendingKey(pendingKey: string): string | null {
  const marker = "/tmp/";
  const idx = pendingKey.indexOf(marker);
  if (idx < 0) return null;
  return `${pendingKey.slice(0, idx)}/${pendingKey.slice(idx + marker.length)}`;
}

export function assertListingScreenshotPendingKey(
  listingId: string,
  objectKey: string
): boolean {
  const prefix = `${STORAGE_FOLDERS.listings}/${listingId}/tmp/`;
  return (
    objectKey.startsWith(prefix) &&
    !objectKey.includes("..") &&
    objectKey.length < 512
  );
}

/** Any object under this listing's prefix (tmp or final). */
export function assertListingScreenshotKey(
  listingId: string,
  objectKey: string
): boolean {
  const prefix = `${STORAGE_FOLDERS.listings}/${listingId}/`;
  return (
    objectKey.startsWith(prefix) &&
    !objectKey.includes("..") &&
    objectKey.length < 512
  );
}
