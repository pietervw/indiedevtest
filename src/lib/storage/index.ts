import "server-only";

import {
  DeleteObjectCommand,
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

export async function createPresignedPutUrl(options: {
  objectKey: string;
  contentType: AllowedImageContentType;
}): Promise<{ uploadUrl: string; objectKey: string }> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  // Do not sign ContentLength — browsers omit/alter it and break the signature.
  // Size is enforced client-side and re-checked via HeadObject on confirm.
  // CacheControl is signed — client PUT must send the same Cache-Control header.
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: options.objectKey,
    ContentType: options.contentType,
    CacheControl: OBJECT_CACHE_CONTROL,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_EXPIRES_SECONDS,
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
  } catch {
    return null;
  }
}

export async function deleteObject(objectKey: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: getR2Bucket(),
      Key: objectKey,
    })
  );
}
