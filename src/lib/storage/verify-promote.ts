import "server-only";

import { imageSize } from "image-size";
import {
  copyObject,
  getObjectBytes,
  headObject,
} from "@/lib/storage";
import { publicUrlForObjectKey } from "@/lib/storage/client";
import {
  isAllowedImageContentType,
  validateImageDimensions,
  type AllowedImageContentType,
  type ImageLimits,
} from "@/lib/storage/image-limits";
import { finalKeyFromPendingKey } from "@/lib/storage/keys";
import type {
  ConfirmImageInput,
  PromotedImage,
} from "@/lib/storage/upload-types";

type ImageRuleLimits = Pick<
  ImageLimits,
  "maxBytes" | "minWidth" | "minHeight" | "maxWidth" | "maxHeight"
>;

/**
 * HEAD + download + dimension check + tmp→final copy for each pending object.
 * Runs verifies in parallel. On any failure, returns already-promoted final keys
 * so the caller can outbox-delete them.
 */
export async function verifyAndPromotePendingImages(
  items: ConfirmImageInput[],
  limits: ImageRuleLimits
): Promise<
  | { ok: true; promoted: PromotedImage[] }
  | { ok: false; message: string; promotedFinalKeys: string[] }
> {
  let heads: Array<{
    contentLength: number | undefined;
    contentType: string | undefined;
  } | null>;
  try {
    heads = await Promise.all(items.map((item) => headObject(item.objectKey)));
  } catch (err) {
    console.error("[storage] headObject failed", err);
    return {
      ok: false,
      message: "Storage temporarily unavailable. Please try again.",
      promotedFinalKeys: [],
    };
  }

  const promotedFinalKeys: string[] = [];
  const promoted: PromotedImage[] = [];

  const results = await Promise.all(
    items.map(async (item, i) => {
      const head = heads[i];
      if (!head) {
        return {
          ok: false as const,
          message: "Upload not found in storage. Please try again.",
        };
      }
      if (
        head.contentLength === undefined ||
        head.contentLength !== item.byteSize ||
        head.contentLength > limits.maxBytes
      ) {
        return { ok: false as const, message: "Uploaded file size mismatch." };
      }
      if (!isAllowedImageContentType(item.contentType)) {
        return { ok: false as const, message: "Invalid image type." };
      }
      const expectedType = item.contentType.split(";")[0]!;
      if (
        head.contentType &&
        !head.contentType.toLowerCase().startsWith(expectedType.toLowerCase())
      ) {
        return { ok: false as const, message: "Uploaded file type mismatch." };
      }

      let bytes: Buffer | null;
      try {
        bytes = await getObjectBytes(item.objectKey);
      } catch (err) {
        console.error("[storage] getObjectBytes failed", err);
        return {
          ok: false as const,
          message: "Storage temporarily unavailable. Please try again.",
        };
      }
      if (!bytes || bytes.byteLength !== item.byteSize) {
        return {
          ok: false as const,
          message: "Upload not found in storage. Please try again.",
        };
      }

      let measured: { width?: number; height?: number };
      try {
        measured = imageSize(bytes);
      } catch {
        return {
          ok: false as const,
          message: "Could not read uploaded image dimensions.",
        };
      }
      if (
        measured.width === undefined ||
        measured.height === undefined ||
        measured.width !== item.width ||
        measured.height !== item.height
      ) {
        return {
          ok: false as const,
          message: "Uploaded image dimensions mismatch.",
        };
      }
      const dimError = validateImageDimensions(
        measured.width,
        measured.height,
        limits
      );
      if (dimError) {
        return { ok: false as const, message: dimError };
      }

      const finalKey = finalKeyFromPendingKey(item.objectKey);
      if (!finalKey) {
        return { ok: false as const, message: "Invalid upload key." };
      }

      try {
        await copyObject({
          sourceKey: item.objectKey,
          destKey: finalKey,
          contentType: item.contentType,
        });
      } catch (err) {
        console.error("[storage] promote failed", err);
        return {
          ok: false as const,
          message: "Could not finalize upload. Please try again.",
        };
      }

      return {
        ok: true as const,
        promoted: {
          objectKey: item.objectKey,
          contentType: item.contentType as AllowedImageContentType,
          byteSize: head.contentLength,
          width: item.width,
          height: item.height,
          finalKey,
          publicUrl: publicUrlForObjectKey(finalKey),
        } satisfies PromotedImage,
      };
    })
  );

  for (const result of results) {
    if (result.ok) {
      promotedFinalKeys.push(result.promoted.finalKey);
      promoted.push(result.promoted);
    }
  }

  const failed = results.find((result) => !result.ok);
  if (failed && !failed.ok) {
    return {
      ok: false,
      message: failed.message,
      promotedFinalKeys,
    };
  }

  return { ok: true, promoted };
}
