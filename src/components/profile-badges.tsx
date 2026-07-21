import {
  BADGE_DEFINITIONS,
  badgeDefinition,
  type BadgeDefinition,
  type EarnedBadge,
} from "@/lib/badges";
import { cn } from "@/lib/utils";

/**
 * Public profile badge strip. Omits the section when the user has none —
 * empty achievement rows read as noise on a public profile.
 */
export function ProfileBadges({
  badges,
  className,
}: {
  badges: EarnedBadge[];
  className?: string;
}) {
  if (badges.length === 0) {
    return null;
  }

  const order = new Map(
    BADGE_DEFINITIONS.map((def, index) => [def.type, index])
  );
  const sorted = [...badges].sort(
    (a, b) =>
      (order.get(a.badgeType) ?? 99) - (order.get(b.badgeType) ?? 99)
  );

  return (
    <section className={cn(className)} aria-label="Badges earned">
      <h2 className="font-display text-2xl font-extrabold text-ink">Badges</h2>
      <ul className="mt-4 flex flex-wrap gap-3">
        {sorted.map((badge) => {
          const def = badgeDefinition(badge.badgeType);
          return (
            <li key={badge.badgeType}>
              <BadgeChip definition={def} earnedAt={badge.earnedAt} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BadgeChip({
  definition,
  earnedAt,
}: {
  definition: BadgeDefinition;
  earnedAt: Date;
}) {
  const earnedLabel = Number.isNaN(earnedAt.getTime())
    ? undefined
    : earnedAt.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

  return (
    <span
      title={
        earnedLabel
          ? `${definition.description} Earned ${earnedLabel}.`
          : definition.description
      }
      className="group inline-flex max-w-xs flex-col gap-0.5 rounded-xl border-2 border-ink bg-brand px-3.5 py-2 text-brand-ink shadow-brutal transition-transform duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span className="font-display text-sm font-bold leading-tight">
        {definition.label}
      </span>
      <span className="text-xs font-medium leading-snug text-brand-ink/80">
        {definition.description}
      </span>
    </span>
  );
}
