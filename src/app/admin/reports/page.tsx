import Link from "next/link";
import { resolveListingReport, restoreListingVisibility } from "@/app/actions/listing-reports";
import { SubmitButton } from "@/components/submit-button";
import { Container } from "@/components/ui/section";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { appPath } from "@/lib/mock-data";
import { listingReportReasonLabels } from "@/lib/listing-reports";

export const metadata = { title: "Listing reports" };

export default async function AdminListingReportsPage() {
  await requireAdmin();
  const [reports, hiddenListings] = await Promise.all([
    prisma.listingReport.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "asc" },
    include: {
      appListing: { select: { id: true, name: true, moderationStatus: true, user: { select: { displayName: true } } } },
    },
    }),
    prisma.appListing.findMany({
      where: { moderationStatus: "hidden" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, user: { select: { displayName: true } } },
    }),
  ]);

  return (
    <div className="flex-1 border-b-2 border-ink bg-grid">
      <Container className="py-14 md:py-20">
        <h1 className="font-display text-3xl font-extrabold text-ink">Listing reports</h1>
        <p className="mt-2 text-ink-muted">Private moderation queue. Reporter identities are intentionally not shown here.</p>
        {reports.length === 0 ? (
          <p className="mt-8 text-ink-muted">No open reports.</p>
        ) : (
          <ul className="mt-8 space-y-5">
            {reports.map((report) => (
              <li key={report.id} className="rounded-2xl border-2 border-ink bg-paper p-5 shadow-brutal">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold text-ink">{report.appListing.name}</h2>
                    <p className="mt-1 text-sm text-ink-muted">by {report.appListing.user.displayName} · {listingReportReasonLabels[report.reason]}</p>
                  </div>
                  <Link href={appPath(report.appListing.id)} className="font-semibold text-ink underline">View listing</Link>
                </div>
                {report.details ? <p className="mt-4 whitespace-pre-wrap text-ink-muted">{report.details}</p> : null}
                <p className="mt-4 text-xs text-ink-muted">Reported {report.createdAt.toLocaleString("en-AU", { timeZone: "Australia/Perth" })} · Current visibility: {report.appListing.moderationStatus}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <form action={resolveListingReport.bind(null, report.id, "dismiss")}><SubmitButton size="sm" variant="secondary" pendingLabel="Dismissing…">Dismiss report</SubmitButton></form>
                  <form action={resolveListingReport.bind(null, report.id, "hide")}><SubmitButton size="sm" variant="secondary" pendingLabel="Hiding…">Hide listing</SubmitButton></form>
                  <form action={resolveListingReport.bind(null, report.id, "remove")}><SubmitButton size="sm" variant="dark" pendingLabel="Removing…">Remove listing</SubmitButton></form>
                </div>
              </li>
            ))}
          </ul>
        )}
        {hiddenListings.length > 0 ? (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-extrabold text-ink">Temporarily hidden listings</h2>
            <ul className="mt-4 space-y-3">
              {hiddenListings.map((listing) => (
                <li key={listing.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-line bg-paper p-4">
                  <span className="font-semibold text-ink">{listing.name} <span className="font-normal text-ink-muted">by {listing.user.displayName}</span></span>
                  <form action={restoreListingVisibility.bind(null, listing.id)}><SubmitButton size="sm" variant="secondary" pendingLabel="Restoring…">Restore visibility</SubmitButton></form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Container>
    </div>
  );
}
