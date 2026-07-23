import { randomUUID } from "crypto";
import {
  extensionForContentType,
  type AllowedImageContentType,
} from "@/lib/storage/image-limits";
import { STORAGE_FOLDERS } from "@/lib/storage/env";

/** Promote tmp key → immutable public key (strip `/tmp/`). */
export function finalKeyFromPendingKey(pendingKey: string): string | null {
  const marker = "/tmp/";
  const idx = pendingKey.indexOf(marker);
  if (idx < 0) return null;
  return `${pendingKey.slice(0, idx)}/${pendingKey.slice(idx + marker.length)}`;
}

function assertSafeObjectKey(objectKey: string, prefix: string): boolean {
  return (
    objectKey.startsWith(prefix) &&
    !objectKey.includes("..") &&
    objectKey.length < 512
  );
}

/** Temporary upload target: listings/{listingId}/tmp/{uuid}.{ext} */
export function listingScreenshotPendingObjectKey(
  listingId: string,
  contentType: AllowedImageContentType
): string {
  const ext = extensionForContentType(contentType);
  return `${STORAGE_FOLDERS.listings}/${listingId}/tmp/${randomUUID()}.${ext}`;
}

export function assertListingScreenshotPendingKey(
  listingId: string,
  objectKey: string
): boolean {
  return assertSafeObjectKey(
    objectKey,
    `${STORAGE_FOLDERS.listings}/${listingId}/tmp/`
  );
}

/** Any object under this listing's prefix (tmp or final). */
export function assertListingScreenshotKey(
  listingId: string,
  objectKey: string
): boolean {
  return assertSafeObjectKey(
    objectKey,
    `${STORAGE_FOLDERS.listings}/${listingId}/`
  );
}

/** Temporary upload: test-feedback/{listingId}/{testerUserId}/tmp/{uuid}.{ext} */
export function testFeedbackPendingObjectKey(
  listingId: string,
  testerUserId: string,
  contentType: AllowedImageContentType
): string {
  const ext = extensionForContentType(contentType);
  return `${STORAGE_FOLDERS.testFeedback}/${listingId}/${testerUserId}/tmp/${randomUUID()}.${ext}`;
}

export function assertTestFeedbackPendingKey(
  listingId: string,
  testerUserId: string,
  objectKey: string
): boolean {
  return assertSafeObjectKey(
    objectKey,
    `${STORAGE_FOLDERS.testFeedback}/${listingId}/${testerUserId}/tmp/`
  );
}

/** Any object under this tester's evidence prefix (tmp or final). */
export function assertTestFeedbackKey(
  listingId: string,
  testerUserId: string,
  objectKey: string
): boolean {
  return assertSafeObjectKey(
    objectKey,
    `${STORAGE_FOLDERS.testFeedback}/${listingId}/${testerUserId}/`
  );
}
