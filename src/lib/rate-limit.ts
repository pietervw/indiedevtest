import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function pruneExpired(now: number) {
  if (buckets.size <= 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Read-only check for the per-instance rate bucket (does not consume a slot).
 */
export function checkRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  pruneExpired(now);
  const current = buckets.get(options.key);

  if (!current || current.resetAt <= now) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Small per-instance safety valve for authenticated actions that send email.
 * Database state transitions remain the source of truth; this only limits
 * bursty abuse without introducing a new service for the MVP.
 *
 * For fallible DB writes: {@link checkRateLimit} first, then call this after
 * success. For external sends with TOCTOU risk: call this to reserve a slot,
 * then {@link releaseRateLimit} if the send fails.
 */
export function takeRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  pruneExpired(now);
  const current = buckets.get(options.key);

  if (!current || current.resetAt <= now) {
    buckets.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Refund one reserved slot after a failed external send. */
export function releaseRateLimit(options: { key: string }): void {
  const now = Date.now();
  const current = buckets.get(options.key);
  if (!current || current.resetAt <= now) return;
  if (current.count <= 1) {
    buckets.delete(options.key);
    return;
  }
  current.count -= 1;
}
