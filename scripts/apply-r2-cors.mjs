#!/usr/bin/env node
/**
 * Apply bucket CORS from r2-cors.json via the R2 S3 API.
 *
 * Requires the same R2_* env vars as the app. This does not run in Docker start —
 * apply once after changing r2-cors.json (or from the Cloudflare dashboard).
 *
 * Loads `.env.local` / `.env` when present; already-exported env vars win.
 * Usage: npm run apply:r2-cors
 */

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: join(root, ".env.local") });
config({ path: join(root, ".env") });

const REQUIRED = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
];

const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(
    `[apply-r2-cors] Missing required env:\n  - ${missing.join("\n  - ")}`
  );
  process.exit(1);
}

const corsPath = join(root, "r2-cors.json");
/** @type {Array<{AllowedOrigins: string[], AllowedMethods: string[], AllowedHeaders: string[], ExposeHeaders?: string[], MaxAgeSeconds?: number}>} */
const corsRules = JSON.parse(readFileSync(corsPath, "utf8"));

const accountId = process.env.R2_ACCOUNT_ID.trim();
const bucket = process.env.R2_BUCKET.trim();

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

await client.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: corsRules,
    },
  })
);

console.log(
  `[apply-r2-cors] Applied CORS from r2-cors.json to bucket "${bucket}".`
);
