import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { deleteObject } from "@/lib/storage";

type Db = PrismaClient | Prisma.TransactionClient;

export type ObjectDeletionJob = {
  objectKey: string;
  /** Defer first attempt (e.g. until a pending PUT URL can no longer succeed). */
  notBefore?: Date;
};

const MAX_ERROR_LEN = 500;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const DEFAULT_BATCH = 50;
/** Cap parallel R2/Prisma work so account-wide deletes don't stampede. */
const SETTLE_CONCURRENCY = 5;

function truncateError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";
  return message.slice(0, MAX_ERROR_LEN);
}

function nextBackoffMs(attempts: number): number {
  const exp = Math.min(attempts, 10);
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** exp);
}

function normalizeJobs(
  jobs: Array<string | ObjectDeletionJob>
): ObjectDeletionJob[] {
  const byKey = new Map<string, Date | undefined>();
  for (const job of jobs) {
    const objectKey = typeof job === "string" ? job : job.objectKey;
    if (!objectKey) continue;
    const notBefore = typeof job === "string" ? undefined : job.notBefore;
    const existing = byKey.get(objectKey);
    // Keep the latest not-before so a deferred pending wins over an immediate final.
    if (
      !byKey.has(objectKey) ||
      (notBefore && (!existing || notBefore > existing))
    ) {
      byKey.set(objectKey, notBefore);
    }
  }
  return [...byKey.entries()].map(([objectKey, notBefore]) => ({
    objectKey,
    notBefore,
  }));
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        await fn(items[index]!);
      }
    }
  );
  await Promise.all(workers);
}

/** Persist keys in the same transaction that removes screenshot DB rows. */
export async function enqueueObjectDeletions(
  db: Db,
  jobs: Array<string | ObjectDeletionJob>
): Promise<void> {
  const normalized = normalizeJobs(jobs);
  if (normalized.length === 0) return;

  const now = new Date();
  await db.storageObjectDeletion.createMany({
    data: normalized.map(({ objectKey, notBefore }) => ({
      objectKey,
      nextAttemptAt:
        notBefore && notBefore > now ? notBefore : now,
    })),
    skipDuplicates: true,
  });
}

/**
 * Attempt R2 deletes for due outbox rows among the given keys. Successful
 * deletes drop the outbox row; failures bump attempts and schedule retry.
 * Keys with nextAttemptAt in the future are left for cron.
 */
export async function settleObjectDeletions(
  objectKeys: string[]
): Promise<{ deleted: number; failed: number; deferred: number }> {
  const keys = [
    ...new Set(objectKeys.filter((key) => key.length > 0)),
  ];
  if (keys.length === 0) {
    return { deleted: 0, failed: 0, deferred: 0 };
  }

  const now = new Date();
  const due = await prisma.storageObjectDeletion.findMany({
    where: {
      objectKey: { in: keys },
      nextAttemptAt: { lte: now },
    },
    select: { objectKey: true },
  });
  const deferred = keys.length - due.length;

  let deleted = 0;
  let failed = 0;

  await mapPool(due, SETTLE_CONCURRENCY, async ({ objectKey }) => {
    try {
      await deleteObject(objectKey);
      await prisma.storageObjectDeletion.deleteMany({
        where: { objectKey },
      });
      deleted += 1;
    } catch (error) {
      failed += 1;
      console.error(
        "[storage] failed to delete object; queued for retry",
        objectKey,
        error
      );
      const attemptAt = new Date();
      const existing = await prisma.storageObjectDeletion.findUnique({
        where: { objectKey },
        select: { attempts: true },
      });
      const attempts = (existing?.attempts ?? 0) + 1;
      await prisma.storageObjectDeletion.upsert({
        where: { objectKey },
        create: {
          objectKey,
          attempts,
          lastError: truncateError(error),
          lastAttemptAt: attemptAt,
          nextAttemptAt: new Date(
            attemptAt.getTime() + nextBackoffMs(attempts)
          ),
        },
        update: {
          attempts,
          lastError: truncateError(error),
          lastAttemptAt: attemptAt,
          nextAttemptAt: new Date(
            attemptAt.getTime() + nextBackoffMs(attempts)
          ),
        },
      });
    }
  });

  return { deleted, failed, deferred };
}

/** Cron worker: retry due outbox rows until R2 removal succeeds. */
export async function processDueObjectDeletions(options?: {
  limit?: number;
}): Promise<{ claimed: number; deleted: number; failed: number }> {
  const limit = options?.limit ?? DEFAULT_BATCH;
  const now = new Date();
  const due = await prisma.storageObjectDeletion.findMany({
    where: { nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { objectKey: true },
  });

  if (due.length === 0) {
    return { claimed: 0, deleted: 0, failed: 0 };
  }

  const result = await settleObjectDeletions(due.map((row) => row.objectKey));
  return {
    claimed: due.length,
    deleted: result.deleted,
    failed: result.failed,
  };
}
