/**
 * Cloudflare R2 configuration.
 * Required in production / Docker. Local `next build` may skip when R2_* are unset
 * only if ALLOW_MISSING_R2=1 (documented for CI image builds without secrets).
 */

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
  endpoint: string;
};

const REQUIRED_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

export function getMissingR2EnvKeys(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  return REQUIRED_KEYS.filter((key) => !env[key]?.trim());
}

/** Throws if any required R2 env var is missing. */
export function requireR2Config(
  env: NodeJS.ProcessEnv = process.env
): R2Config {
  const missing = getMissingR2EnvKeys(env);
  if (missing.length > 0) {
    throw new Error(
      `Missing required Cloudflare R2 environment variables: ${missing.join(", ")}. ` +
        `Set them in Coolify / .env.local (see .env.example).`
    );
  }

  const accountId = env.R2_ACCOUNT_ID!.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID!.trim();
  const publicBaseUrl = env.R2_PUBLIC_BASE_URL!.trim().replace(/\/$/, "");

  // R2 rejects non-32-char access keys with 400 (often misread as CORS in browsers).
  if (accessKeyId.length !== 32) {
    throw new Error(
      `R2_ACCESS_KEY_ID length is ${accessKeyId.length}, expected 32. ` +
        `Create an R2 S3 API token (Dashboard → R2 → Manage R2 API Tokens) and use its Access Key ID — not a Cloudflare API token.`
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!.trim(),
    bucket: env.R2_BUCKET!.trim(),
    publicBaseUrl,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

/** Object key prefixes inside the shared bucket. */
export const STORAGE_FOLDERS = {
  listings: "listings",
  testFeedback: "test-feedback",
} as const;
