import { cn } from "@/lib/utils";
import { TESTER_SLOT_MAX } from "@/lib/mock-data";

export function ProgressBar({
  value,
  max = TESTER_SLOT_MAX,
  className,
}: {
  value: number;
  max?: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));

  return (
    <div
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-full border border-ink bg-paper",
        className
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className="h-full rounded-full bg-brand"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
