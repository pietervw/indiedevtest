import { randomUUID } from "crypto";
import {
  extensionForContentType,
  type AllowedImageContentType,
} from "@/lib/storage/image-limits";
import { STORAGE_FOLDERS } from "@/lib/storage/env";

/** listings/{listingId}/{uuid}.{ext} */
export function listingScreenshotObjectKey(
  listingId: string,
  contentType: AllowedImageContentType
): string {
  const ext = extensionForContentType(contentType);
  return `${STORAGE_FOLDERS.listings}/${listingId}/${randomUUID()}.${ext}`;
}

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
