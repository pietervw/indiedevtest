import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { runListing14DayReminders } from "@/lib/listing-14-day-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

async function handle(request: Request) {
  if (!authorizeCronRequest(request)) {
    return unauthorized();
  }

  const summary = await runListing14DayReminders();
  return NextResponse.json(summary);
}

/** Coolify / external schedulers may use GET or POST. */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
