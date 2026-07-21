import { DashboardActivity } from "@/components/dashboard-activity";
import { requireOnboarded } from "@/lib/auth-guards";
import { getDashboardData } from "@/lib/dashboard";
import { canonicalMetadata } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  ...canonicalMetadata("/dashboard"),
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/** Private activity centre for a fully onboarded developer/tester. */
export default async function DashboardPage() {
  const user = await requireOnboarded();
  const data = await getDashboardData(user.id);

  return <DashboardActivity displayName={user.displayName} data={data} />;
}
