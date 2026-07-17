import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

type WaitlistEntry = {
  email: string;
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const WAITLIST_PATH = path.join(DATA_DIR, "waitlist.json");

let writeChain: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const next = writeChain.then(task, task);
  writeChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function isErrno(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === "object" && err !== null && "code" in err;
}

async function readEntries(): Promise<WaitlistEntry[]> {
  try {
    const raw = await readFile(WAITLIST_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("waitlist.json is not an array");
    }
    return parsed.filter(
      (entry): entry is WaitlistEntry =>
        typeof entry === "object" &&
        entry !== null &&
        "email" in entry &&
        "createdAt" in entry &&
        typeof entry.email === "string" &&
        typeof entry.createdAt === "string"
    );
  } catch (err) {
    if (isErrno(err) && err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeEntries(entries: WaitlistEntry[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmpPath = path.join(
    DATA_DIR,
    `waitlist.${process.pid}.${Date.now()}.tmp`
  );
  try {
    await writeFile(tmpPath, `${JSON.stringify(entries)}\n`, "utf8");
    await rename(tmpPath, WAITLIST_PATH);
  } catch (err) {
    await unlink(tmpPath).catch(() => undefined);
    throw err;
  }
}

/** Expects an already-normalized (trim + lowercase) email. */
export async function addToWaitlist(
  email: string
): Promise<{ alreadyExists: boolean }> {
  return enqueueWrite(async () => {
    const entries = await readEntries();

    if (entries.some((entry) => entry.email === email)) {
      return { alreadyExists: true };
    }

    entries.push({
      email,
      createdAt: new Date().toISOString(),
    });

    await writeEntries(entries);
    return { alreadyExists: false };
  });
}
