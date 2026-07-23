import "server-only";

import { S3Client } from "@aws-sdk/client-s3";
import { requireR2Config } from "@/lib/storage/env";

let client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (client) return client;
  const config = requireR2Config();
  client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return client;
}

export function getR2Bucket(): string {
  return requireR2Config().bucket;
}

export function publicUrlForObjectKey(objectKey: string): string {
  const { publicBaseUrl } = requireR2Config();
  const key = objectKey.replace(/^\//, "");
  return `${publicBaseUrl}/${key}`;
}
