import "server-only";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  getR2Bucket,
  getR2Client,
} from "@/lib/storage/client";
import type { AllowedImageContentType } from "@/lib/storage/image-limits";
import { OBJECT_CACHE_CONTROL } from "@/lib/storage/image-limits";

const PRESIGN_EXPIRES_SECONDS = 10 * 60;

function isMissingObjectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const code = err.name ?? err.Code;
  if (code === "NotFound" || code === "NoSuchKey") return true;
  return err.$metadata?.httpStatusCode === 404;
}

export async function createPresignedPutUrl(options: {
  objectKey: string;
  contentType: AllowedImageContentType;
  /** Exact byte length; signed so oversized PUTs are rejected by R2. */
  contentLength: number;
}): Promise<{ uploadUrl: string; objectKey: string }> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  // Sign ContentLength so a slot minted for a small file cannot accept a large PUT.
  // fetch(File) sets Content-Length automatically; CORS allows the header.
  // CacheControl is also signed — client PUT must send the same Cache-Control.
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: options.objectKey,
    ContentType: options.contentType,
    ContentLength: options.contentLength,
    CacheControl: OBJECT_CACHE_CONTROL,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_EXPIRES_SECONDS,
    // Non-x-amz headers are only enforced when listed here (SDK v3).
    signableHeaders: new Set([
      "content-length",
      "content-type",
      "cache-control",
    ]),
  });

  return {
    uploadUrl,
    objectKey: options.objectKey,
  };
}

export async function headObject(objectKey: string): Promise<{
  contentLength: number | undefined;
  contentType: string | undefined;
} | null> {
  try {
    const result = await getR2Client().send(
      new HeadObjectCommand({
        Bucket: getR2Bucket(),
        Key: objectKey,
      })
    );
    return {
      contentLength: result.ContentLength,
      contentType: result.ContentType,
    };
  } catch (error) {
    if (isMissingObjectError(error)) return null;
    throw error;
  }
}

/** Copy within the bucket (tmp → final). Callers delete the source after. */
export async function copyObject(options: {
  sourceKey: string;
  destKey: string;
  contentType: AllowedImageContentType;
}): Promise<void> {
  const bucket = getR2Bucket();
  await getR2Client().send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${options.sourceKey}`,
      Key: options.destKey,
      ContentType: options.contentType,
      CacheControl: OBJECT_CACHE_CONTROL,
      MetadataDirective: "REPLACE",
    })
  );
}

export async function deleteObject(objectKey: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: getR2Bucket(),
      Key: objectKey,
    })
  );
}

/** Read object bytes (screenshots are capped at IMAGE_LIMITS.maxBytes). */
export async function getObjectBytes(objectKey: string): Promise<Buffer | null> {
  try {
    const result = await getR2Client().send(
      new GetObjectCommand({
        Bucket: getR2Bucket(),
        Key: objectKey,
      })
    );
    if (!result.Body) return null;
    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error) {
    if (isMissingObjectError(error)) return null;
    throw error;
  }
}
