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

console.log("[check-storage-env] R2 storage environment OK.");
