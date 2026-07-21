import Image from "next/image";
import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { TESTER_SLOT_MAX, type App } from "@/lib/mock-data";

function DevAvatar({
  displayName,
  imageUrl,
  profileHref,
}: NonNullable<App["developer"]>) {
  const avatar = imageUrl ? (
    <Image
      src={imageUrl}
      alt=""
      width={40}
      height={40}
      className="size-10 rounded-xl border-2 border-ink object-cover"
    />
  ) : (
    <span className="flex size-10 items-center justify-center rounded-xl border-2 border-ink bg-paper-muted font-display text-lg font-bold text-ink">
      {displayName.charAt(0).toUpperCase()}
    </span>
  );

  return (
    <Link
      href={profileHref}
      className="relative z-10 inline-flex shrink-0 transition-opacity hover:opacity-80"
      title={`${displayName}'s profile`}
    >
      {avatar}
      <span className="sr-only">{displayName}</span>
    </Link>
  );
}

function DevPlaceholder() {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-paper-muted font-display text-lg font-bold text-ink-muted"
    >
      ?
    </span>
  );
}

export function AppBoard({
  apps,
  className,
}: {
  apps: App[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-brutal-lg",
        className
      )}
    >
      <div className="flex items-center justify-between border-b-2 border-ink bg-brand px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <span
              key={i}
              className="size-3 rounded-full border-2 border-ink bg-paper"
            />
          ))}
        </div>
        <p className="font-display text-sm font-bold text-brand-ink sm:text-base">
          Apps needing testers
        </p>
        <Badge variant="dark" size="sm">
          Live
        </Badge>
      </div>

      <ul className="divide-y-2 divide-line">
        {apps.map((app) => (
          <li
            key={app.id}
            className={cn(
              "relative",
              app.browseState === "own" && "bg-paper-muted opacity-60",
              app.browseState === "requested" && "bg-brand/10",
              app.browseState === "testing" && "bg-brand/20"
            )}
          >
            {app.href ? (
              <Link
                href={app.href}
                className="absolute inset-0 z-0"
                aria-label={`View ${app.name}`}
              />
            ) : null}
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-paper-muted sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                {app.developer ? (
                  <DevAvatar {...app.developer} />
                ) : (
                  <DevPlaceholder />
                )}
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <AppLogo
                      name={app.name}
                      logoUrl={app.logoUrl}
                      size="xs"
                      className="border-0"
                    />
                    <p className="truncate font-display font-bold text-ink">
                      {app.name}
                    </p>
                  </div>
                  <p className="truncate text-sm text-ink-muted">
                    {app.category} · {app.platform}
                    {app.developer ? ` · ${app.developer.displayName}` : null}
                  </p>
                  {app.browseState ? (
                    <Badge
                      variant={app.browseState === "own" ? "muted" : "dark"}
                      size="sm"
                      className="mt-1"
                    >
                      {app.browseState === "own"
                        ? "Your app"
                        : app.browseState === "requested"
                          ? "Requested"
                          : "You’re testing"}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="relative z-10 w-24 shrink-0 sm:w-28">
                <p className="mb-1 text-right font-display text-xs font-bold text-ink sm:text-sm">
                  {app.testers}/{TESTER_SLOT_MAX}
                </p>
                <ProgressBar value={app.testers} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
