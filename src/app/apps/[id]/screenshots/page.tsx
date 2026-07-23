import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ScreenshotManager } from "@/components/screenshot-manager";
import { Container } from "@/components/ui/section";
import { requireDbUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { appPath, editPath, screenshotsPath } from "@/lib/mock-data";
import { canonicalMetadata } from "@/lib/site";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    ...canonicalMetadata(screenshotsPath(id)),
    title: "Screenshots",
    robots: { index: false, follow: false },
  };
}

export default async function ListingScreenshotsPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
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

  const createMode = isNew === "1";

  return (
    <div className="relative flex-1 overflow-hidden bg-grid">
      <div className="pointer-events-none absolute -right-16 top-8 size-56 rounded-full bg-brand/20" />
      <Container className="relative py-14 md:py-20">
        {createMode ? (
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Step 2 of 2
          </p>
        ) : (
          <p className="text-sm font-semibold text-ink-muted">
            <Link
              href={editPath(id)}
              className="transition-colors hover:text-ink"
            >
              ← Back to edit
            </Link>
          </p>
        )}
        <h1 className="mt-2 max-w-xl font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
          {createMode ? "Add screenshots" : `Screenshots · ${listing.name}`}
        </h1>
        <p className="mt-3 max-w-lg text-lg text-ink-muted">
          {createMode
            ? "Show what your app looks like. Drag to reorder — you can change these anytime."
            : "Upload, remove, or drag to reorder. Up to 5 screenshots."}
        </p>
        <div className="mt-10">
          <ScreenshotManager
            listingId={listing.id}
            mode={createMode ? "create" : "edit"}
            initialScreenshots={listing.screenshots}
          />
        </div>
      </Container>
    </div>
  );
}
