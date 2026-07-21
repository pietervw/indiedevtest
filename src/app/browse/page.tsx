import { AppBoard } from "@/components/app-board";
import { BrowseAddButton, BrowseEmptyCta } from "@/components/browse-add-button";
import { BrowseFilters } from "@/components/browse-filters";
import { Container, SectionHeading } from "@/components/ui/section";
import { getBrowseApps, parseBrowseFilters } from "@/lib/browse-apps";
import { getOptionalDbUser } from "@/lib/auth-guards";
import { canonicalMetadata, siteConfig } from "@/lib/site";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  ...canonicalMetadata("/browse"),
  title: "Browse",
  description: `Browse open testing listings on ${siteConfig.name}.`,
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BrowsePage({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const filters = parseBrowseFilters(params);
  const viewer = await getOptionalDbUser();
  const apps = await getBrowseApps(filters, viewer?.id);
  const hasActiveFilters = Boolean(filters.category || filters.platform);

  return (
    <div className="flex-1 bg-grid">
      <Container className="py-14 md:py-20">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            className="mx-0 mb-0 max-w-2xl text-left"
            title="Browse"
            description="Apps open for testing from fellow indie developers."
          />
          <BrowseAddButton />
        </div>

        <BrowseFilters filters={filters} />

        {apps.length > 0 ? (
          <AppBoard apps={apps} className="max-w-2xl" />
        ) : hasActiveFilters ? (
          <p className="max-w-md text-ink-muted">
            No open listings match these filters.{" "}
            <a href="/browse" className="font-semibold text-ink underline">
              Clear filters
            </a>
          </p>
        ) : (
          <BrowseEmptyCta />
        )}
      </Container>
    </div>
  );
}
