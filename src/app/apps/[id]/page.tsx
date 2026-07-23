import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppLogo } from "@/components/app-logo";
import { JsonLd } from "@/components/json-ld";
import { ListingScreenshotGallery } from "@/components/listing-screenshot-gallery";
import {
  ListingPageHeader,
  ListingSessionPanels,
  ListingSessionProvider,
} from "@/components/listing-session-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { ProgressBar } from "@/components/ui/progress";
import { ShareListing } from "@/components/share-listing";
import { ListingReportForm } from "@/components/listing-report-form";
import { TesterFeedbackList } from "@/components/tester-feedback-list";
import { getOptionalDbUser } from "@/lib/auth-guards";
import {
  appPath,
  categoryLabel,
  platformLabel,
  profilePath,
  statusLabel,
} from "@/lib/mock-data";
import { getOwnerListing, getPublicListing } from "@/lib/public-listing";
import { isReviewableListingStatus } from "@/lib/listing-status";
import { absoluteUrl, canonicalMetadata, siteConfig } from "@/lib/site";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // Public loader only — drafts never leak name/description via metadata.
  const listing = await getPublicListing(id);

  if (!listing) {
    return { title: "App not found" };
  }

  const ogImages =
    listing.screenshots.length > 0
      ? listing.screenshots.slice(0, 4).map((shot) => ({
          url: shot.publicUrl,
          width: shot.width,
          height: shot.height,
          alt: `${listing.name} screenshot`,
        }))
      : listing.logoUrl
        ? [{ url: listing.logoUrl, alt: listing.name }]
        : undefined;

  return {
    ...canonicalMetadata(appPath(id)),
    title: listing.name,
    description: listing.description.slice(0, 160),
    openGraph: {
      ...canonicalMetadata(appPath(id)).openGraph,
      title: listing.name,
      description: listing.description.slice(0, 160),
      type: "website",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: listing.name,
      description: listing.description.slice(0, 160),
      images: ogImages?.map((img) => img.url),
    },
  };
}

export default async function AppListingPage({ params }: Props) {
  await connection();
  const { id } = await params;

  const viewer = await getOptionalDbUser();
  let listing = await getPublicListing(id);
  if (!listing) {
    if (viewer) {
      listing = await getOwnerListing(id, viewer.id);
    }
  }
  if (!listing) {
    notFound();
  }

  const showFeedbackSection = isReviewableListingStatus(listing.status);
  const isOwner = viewer?.id === listing.userId;
  const visibleFeedback =
    !showFeedbackSection
      ? []
      : listing.showTesterFeedback || isOwner
        ? listing.feedback
        : listing.feedback.filter((item) => item.tester.id === viewer?.id);
  const profileHref = profilePath(listing.user.profileSlug);
  const galleryImages = listing.screenshots.map((shot, index) => ({
    id: shot.id,
    publicUrl: shot.publicUrl,
    width: shot.width,
    height: shot.height,
    alt: `${listing.name} screenshot ${index + 1}`,
  }));

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: listing.name,
    description: listing.description,
    applicationCategory:
      listing.category === "game" ? "GameApplication" : "UtilitiesApplication",
    operatingSystem: listing.platform === "ios" ? "iOS" : "Android",
    url: absoluteUrl(appPath(listing.id)),
    image:
      galleryImages.length > 0
        ? galleryImages.map((img) => img.publicUrl)
        : listing.logoUrl || undefined,
    author: {
      "@type": "Person",
      name: listing.user.displayName,
      url: absoluteUrl(profileHref),
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <div className="flex-1 border-b-2 border-ink bg-grid">
      <JsonLd data={softwareJsonLd} />
      <Container className="py-14 md:py-20">
        <ListingSessionProvider listingId={listing.id}>
          <ListingPageHeader listingId={listing.id} />

          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            <AppLogo
              name={listing.name}
              logoUrl={listing.logoUrl}
              platform={listing.platform}
              size="lg"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="dark" size="sm">
                  {statusLabel[listing.status] ?? listing.status}
                </Badge>
                <Badge variant="outline" size="sm">
                  {categoryLabel[listing.category] ?? listing.category}
                </Badge>
                <Badge variant="muted" size="sm">
                  {platformLabel[listing.platform] ?? listing.platform}
                </Badge>
              </div>

              <h1 className="mt-3 font-display text-3xl font-extrabold text-ink sm:text-4xl">
                {listing.name}
              </h1>

              <Link
                href={profileHref}
                className="mt-3 inline-flex items-center gap-2 transition-opacity hover:opacity-80"
              >
                {listing.user.imageUrl ? (
                  <Image
                    src={listing.user.imageUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 rounded-full border-2 border-ink object-cover"
                  />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full border-2 border-ink bg-paper-muted text-sm font-bold">
                    {listing.user.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="font-semibold text-ink">
                  {listing.user.displayName}
                </span>
                <span className="text-sm text-ink-muted">
                  View developer profile
                </span>
              </Link>

              <div className="mt-6 max-w-xs">
                <div className="mb-1 flex justify-between font-display text-sm font-bold text-ink">
                  <span>Accepted testers</span>
                  <span>
                    {listing.testerCapacity === null
                      ? `${listing.acceptedTesters} accepted`
                      : `${listing.acceptedTesters}/${listing.testerCapacity}`}
                  </span>
                </div>
                {listing.testerCapacity !== null ? (
                  <ProgressBar
                    value={listing.acceptedTesters}
                    max={listing.testerCapacity}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <ListingScreenshotGallery images={galleryImages} />

          <div className="mt-10 max-w-2xl">
            <h2 className="font-display text-xl font-extrabold text-ink">
              About
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed text-ink-muted">
              {listing.description}
            </p>
          </div>

          {listing.status === "launched" && listing.storeLink ? (
            <div className="mt-8">
              <Button href={listing.storeLink} size="md" variant="dark">
                View on store
              </Button>
            </div>
          ) : null}

          <ListingSessionPanels
            listingId={listing.id}
            listingStatus={listing.status}
          />

          {(listing.status === "open_for_testing" ||
            listing.status === "closed_for_testing") && (
            <ShareListing
              appName={listing.name}
              url={absoluteUrl(appPath(listing.id))}
            />
          )}

          {viewer && viewer.id !== listing.userId ? (
            <ListingReportForm listingId={listing.id} />
          ) : null}

          {showFeedbackSection ? (
            <section className="mt-14 max-w-2xl">
              <h2 className="font-display text-xl font-extrabold text-ink">
                Tester feedback
              </h2>
              {!listing.showTesterFeedback && isOwner ? (
                <p className="mt-2 text-sm text-ink-muted">
                  Feedback is hidden from the public listing. You and each
                  tester can still see their own submission. Toggle visibility
                  when editing the listing.
                </p>
              ) : null}
              {!listing.showTesterFeedback && !isOwner && visibleFeedback.length === 0 ? (
                <p className="mt-3 text-ink-muted">
                  The developer has hidden tester feedback on this listing.
                </p>
              ) : (
                <TesterFeedbackList feedback={visibleFeedback} />
              )}
            </section>
          ) : null}

          <p className="mt-12 text-sm text-ink-muted">
            On {siteConfig.name} · listed for reciprocal testing
          </p>
        </ListingSessionProvider>
      </Container>
    </div>
  );
}
