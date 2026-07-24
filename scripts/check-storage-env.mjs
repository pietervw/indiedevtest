#!/usr/bin/env node
/**
 * Fail closed when Cloudflare R2 env vars are missing.
 * Used by Docker entrypoint and `npm run check:storage-env`.
 *
 * Docker image builds may set ALLOW_MISSING_R2=1 with NODE_ENV unset/development.
 * Production / Coolify runtime must NOT set ALLOW_MISSING_R2.
 */

const REQUIRED = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
];

/** R2 S3 Access Key ID length. Wrong keys (e.g. cfut_…) fail PUTs with a CORS-looking 400. */
const R2_ACCESS_KEY_ID_LENGTH = 32;

if (process.env.ALLOW_MISSING_R2 === "1") {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[check-storage-env] ALLOW_MISSING_R2=1 is not allowed when NODE_ENV=production."
    );
    process.exit(1);
  }
  console.warn(
    "[check-storage-env] ALLOW_MISSING_R2=1 — skipping R2 env validation."
  );
  process.exit(0);
}

const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(
    `[check-storage-env] Missing required R2 environment variables:\n  - ${missing.join("\n  - ")}`
  );
  console.error(
    "Set them from .env.example (bucket indiedevtest, folders listings/ and test-feedback/)."
  );
  process.exit(1);
}

const accessKeyId = process.env.R2_ACCESS_KEY_ID.trim();
if (accessKeyId.length !== R2_ACCESS_KEY_ID_LENGTH) {
  console.error(
    `[check-storage-env] R2_ACCESS_KEY_ID length is ${accessKeyId.length}, expected ${R2_ACCESS_KEY_ID_LENGTH}.`
  );
  console.error(
    "Use an R2 S3 API token Access Key ID (Dashboard → R2 → Manage R2 API Tokens), not a Cloudflare API token."
  );
  process.exit(1);
}

console.log("[check-storage-env] R2 storage environment OK.");
