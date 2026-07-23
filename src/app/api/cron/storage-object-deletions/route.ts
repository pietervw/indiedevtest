import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { processDueObjectDeletions } from "@/lib/storage/deletion-outbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

async function handle(request: Request) {
  if (!authorizeCronRequest(request)) {
    return unauthorized();
  }

  const summary = await processDueObjectDeletions();
  return NextResponse.json(summary);
}

/** Coolify / external schedulers may use GET or POST. */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
