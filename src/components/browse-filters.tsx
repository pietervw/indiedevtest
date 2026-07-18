import Link from "next/link";
import type {
  BrowseCategory,
  BrowseFilters as BrowseFilterState,
  BrowsePlatform,
  BrowseSort,
} from "@/lib/browse-apps";
import { categoryLabel, platformLabel } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function browseHref(next: BrowseFilterState): string {
  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  if (next.platform) params.set("platform", next.platform);
  if (next.sort !== "newest") params.set("sort", next.sort);
  const qs = params.toString();
  return qs ? `/browse?${qs}` : "/browse";
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center rounded-lg border-2 px-3 text-sm font-semibold transition-colors",
        active
          ? "border-ink bg-ink text-paper"
          : "border-ink bg-paper text-ink hover:bg-paper-muted"
      )}
    >
      {children}
    </Link>
  );
}

const CATEGORIES = Object.keys(categoryLabel) as BrowseCategory[];
const PLATFORMS = Object.keys(platformLabel) as BrowsePlatform[];
const SORTS: { value: BrowseSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "requested", label: "Most requested" },
  { value: "needed", label: "Most testers needed" },
];

export function BrowseFilters({ filters }: { filters: BrowseFilterState }) {
  return (
    <div className="mb-8 flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
          Category
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip
            href={browseHref({ ...filters, category: undefined })}
            active={!filters.category}
          >
            All
          </Chip>
          {CATEGORIES.map((key) => (
            <Chip
              key={key}
              href={browseHref({ ...filters, category: key })}
              active={filters.category === key}
            >
              {categoryLabel[key]}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
          Platform
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip
            href={browseHref({ ...filters, platform: undefined })}
            active={!filters.platform}
          >
            All
          </Chip>
          {PLATFORMS.map((key) => (
            <Chip
              key={key}
              href={browseHref({ ...filters, platform: key })}
              active={filters.platform === key}
            >
              {platformLabel[key]}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
          Sort
        </p>
        <div className="flex flex-wrap gap-2">
          {SORTS.map((option) => (
            <Chip
              key={option.value}
              href={browseHref({ ...filters, sort: option.value })}
              active={filters.sort === option.value}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
