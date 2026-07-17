import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { TESTER_SLOT_MAX, type App } from "@/lib/mock-data";

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
            className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-paper-muted sm:px-5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-ink font-display text-lg font-bold text-brand">
                {app.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display font-bold text-ink">
                  {app.name}
                </p>
                <p className="truncate text-sm text-ink-muted">
                  {app.category} · {app.platform}
                </p>
              </div>
            </div>
            <div className="w-24 shrink-0 sm:w-28">
              <p className="mb-1 text-right font-display text-xs font-bold text-ink sm:text-sm">
                {app.testers}/{TESTER_SLOT_MAX}
              </p>
              <ProgressBar value={app.testers} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
