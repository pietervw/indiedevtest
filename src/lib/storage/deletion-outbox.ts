import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { deleteObject } from "@/lib/storage";

type Db = PrismaClient | Prisma.TransactionClient;

const MAX_ERROR_LEN = 500;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const DEFAULT_BATCH = 50;

function uniqueKeys(objectKeys: string[]): string[] {
  return [...new Set(objectKeys.filter((key) => key.length > 0))];
}

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

/** Persist keys in the same transaction that removes screenshot DB rows. */
export async function enqueueObjectDeletions(
  db: Db,
  objectKeys: string[]
): Promise<void> {
  const keys = uniqueKeys(objectKeys);
  if (keys.length === 0) return;

  await db.storageObjectDeletion.createMany({
    data: keys.map((objectKey) => ({ objectKey })),
    skipDuplicates: true,
  });
}

/**
 * Attempt R2 deletes for the given keys. Successful deletes drop the outbox
 * row; failures bump attempts and schedule the next retry.
 */
export async function settleObjectDeletions(
  objectKeys: string[]
): Promise<{ deleted: number; failed: number }> {
  const keys = uniqueKeys(objectKeys);
  if (keys.length === 0) return { deleted: 0, failed: 0 };

  let deleted = 0;
  let failed = 0;

  await Promise.all(
    keys.map(async (objectKey) => {
      try {
        await deleteObject(objectKey);
        await prisma.storageObjectDeletion.deleteMany({
          where: { objectKey },
        });
        deleted += 1;
      } catch (error) {
        failed += 1;
        console.error("[storage] failed to delete object; queued for retry", objectKey, error);
        const now = new Date();
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
            lastAttemptAt: now,
            nextAttemptAt: new Date(now.getTime() + nextBackoffMs(attempts)),
          },
          update: {
            attempts,
            lastError: truncateError(error),
            lastAttemptAt: now,
            nextAttemptAt: new Date(now.getTime() + nextBackoffMs(attempts)),
          },
        });
      }
    })
  );

  return { deleted, failed };
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
  return { claimed: due.length, ...result };
}
