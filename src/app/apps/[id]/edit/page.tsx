import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EditAppListingForm } from "@/components/edit-app-listing-form";
import { ScreenshotManager } from "@/components/screenshot-manager";
import { Container } from "@/components/ui/section";
import { requireDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { appPath, editPath } from "@/lib/mock-data";
import { canonicalMetadata } from "@/lib/site";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    ...canonicalMetadata(editPath(id)),
    title: "Edit app",
    robots: { index: false, follow: false },
  };
}

export default async function EditAppPage({ params }: Props) {
  const { id } = await params;
  const user = await requireDbUser();

  if (!process.env.DATABASE_URL) {
    notFound();
  }

  const listing = await prisma.appListing.findUnique({
    where: { id },
    include: {
      screenshots: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!listing) {
    notFound();
  }

  if (listing.userId !== user.id) {
    redirect(appPath(id));
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-grid">
      <div className="pointer-events-none absolute -left-16 top-12 size-56 rounded-full bg-brand/20" />
      <Container className="relative py-14 md:py-20">
        <p className="text-sm font-semibold text-ink-muted">
          <Link href={appPath(id)} className="transition-colors hover:text-ink">
            ← Back to listing
          </Link>
        </p>
        <h1 className="mt-4 max-w-xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
          Edit {listing.name}
        </h1>
        <p className="mt-3 max-w-lg text-lg text-ink-muted">
          Update details or move the listing through the testing lifecycle.
        </p>
        <div className="mt-10">
          <EditAppListingForm
            listingId={listing.id}
            defaults={{
              name: listing.name,
              description: listing.description,
              category: listing.category,
              platform: listing.platform,
              logoUrl: listing.logoUrl,
              testingAccessUrl: listing.testingAccessUrl ?? "",
              testerInstructions: listing.testerInstructions ?? "",
              testerCapacity: listing.testerCapacity,
              status: listing.status,
              storeLink: listing.storeLink ?? "",
            }}
          />
        </div>

        <section className="mt-16 max-w-xl border-t-2 border-ink pt-12">
          <h2 className="font-display text-2xl font-extrabold text-ink">
            Screenshots
          </h2>
          <p className="mt-2 text-ink-muted">
            Optional but recommended. Drag to reorder; visitors see these above
            About on your listing.
          </p>
          <div className="mt-6">
            <ScreenshotManager
              listingId={listing.id}
              mode="edit"
              initialScreenshots={listing.screenshots}
            />
          </div>
        </section>
      </Container>
    </div>
  );
}
