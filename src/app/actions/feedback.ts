"use server";

import { TesterFeedbackSeverity, TesterFeedbackStatus } from "@/generated/prisma";
import { requireDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { field } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { appPath } from "@/lib/mock-data";

export type FeedbackState = { ok: boolean; message: string };

export async function submitTesterFeedback(
  listingId: string,
  _prev: FeedbackState,
  formData: FormData
): Promise<FeedbackState> {
  const user = await requireDbUser();
  const severity = field(formData, "severity");
  const title = field(formData, "title");
  const details = field(formData, "details");
  const steps = field(formData, "steps");
  const device = field(formData, "device");
  if (!Object.values(TesterFeedbackSeverity).includes(severity as TesterFeedbackSeverity)) return { ok: false, message: "Choose a severity." };
  if (title.length < 3 || title.length > 120) return { ok: false, message: "Title must be 3–120 characters." };
  if (details.length < 10 || details.length > 4000) return { ok: false, message: "Describe the issue in 10–4,000 characters." };
  if (steps.length > 4000) return { ok: false, message: "Steps must be 4,000 characters or fewer." };
  if (device.length > 160) return { ok: false, message: "Device must be 160 characters or fewer." };

  const assignment = await prisma.testAssignment.findUnique({
    where: { appListingId_testerUserId: { appListingId: listingId, testerUserId: user.id } },
    select: { id: true },
  });
  if (!assignment) return { ok: false, message: "Join this testing track before sending private feedback." };
  await prisma.testerFeedback.create({
    data: { appListingId: listingId, testerUserId: user.id, severity: severity as TesterFeedbackSeverity, title, details, steps: steps || null, device: device || null },
  });
  revalidatePath(appPath(listingId));
  revalidatePath("/dashboard");
  return { ok: true, message: "Private feedback sent to the developer." };
}

/** Lets only the listing owner track the resolution of private tester feedback. */
export async function updateTesterFeedbackStatus(feedbackId: string, formData: FormData) {
  const user = await requireDbUser();
  const status = field(formData, "status");
  if (!Object.values(TesterFeedbackStatus).includes(status as TesterFeedbackStatus)) {
    return;
  }

  const feedback = await prisma.testerFeedback.findFirst({
    where: { id: feedbackId, appListing: { userId: user.id } },
    select: { id: true, appListingId: true },
  });
  if (!feedback) return;

  await prisma.testerFeedback.update({
    where: { id: feedback.id },
    data: { status: status as TesterFeedbackStatus },
  });
  revalidatePath(appPath(feedback.appListingId));
  revalidatePath("/dashboard");
}
