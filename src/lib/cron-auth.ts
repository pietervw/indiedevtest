import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Authorize a scheduler request via `Authorization: Bearer <CRON_SECRET>`.
 * Uses constant-time comparison; returns false when the secret is unset.
 */
export function authorizeCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const token = header.slice("Bearer ".length);
  return safeEqualString(token, secret);
}

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Spend comparable work so length mismatches are not a cheap exit.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
