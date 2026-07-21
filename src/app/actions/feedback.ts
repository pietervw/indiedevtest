"use server";

import { TesterFeedbackSeverity } from "@/generated/prisma";
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
  if (!Object.values(TesterFeedbackSeverity).includes(severity as TesterFeedbackSeverity)) return { ok: false, message: "Choose a severity." };
  if (title.length < 3 || title.length > 120) return { ok: false, message: "Title must be 3–120 characters." };
  if (details.length < 10 || details.length > 4000) return { ok: false, message: "Describe the issue in 10–4,000 characters." };
  if (steps.length > 4000) return { ok: false, message: "Steps must be 4,000 characters or fewer." };

  const assignment = await prisma.testAssignment.findUnique({
    where: { appListingId_testerUserId: { appListingId: listingId, testerUserId: user.id } },
    select: { id: true },
  });
  if (!assignment) return { ok: false, message: "Join this testing track before sending private feedback." };
  await prisma.testerFeedback.create({
    data: { appListingId: listingId, testerUserId: user.id, severity: severity as TesterFeedbackSeverity, title, details, steps: steps || null },
  });
  revalidatePath(appPath(listingId));
  revalidatePath("/dashboard");
  return { ok: true, message: "Private feedback sent to the developer." };
}
