import Image from "next/image";
import Link from "next/link";
import type { LeaderboardEntry, Leaderboards } from "@/lib/leaderboards";

const BOARDS: {
  key: keyof Leaderboards;
  title: string;
  unit: string;
}[] = [
  { key: "mostTested", title: "Most apps tested", unit: "done" },
  { key: "mostLaunched", title: "Most apps launched", unit: "live" },
  { key: "mostReviews", title: "Most tester feedback", unit: "feedback" },
];

function Board({
  title,
  unit,
  entries,
}: {
  title: string;
  unit: string;
  entries: LeaderboardEntry[];
}) {
  return (
    <div>
      <h3 className="font-display text-xl font-extrabold text-ink">{title}</h3>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">No rankings yet — be first.</p>
      ) : (
        <ol className="mt-4 divide-y-2 divide-line overflow-hidden rounded-2xl border-2 border-ink bg-paper">
          {entries.map((entry, index) => (
            <li
              key={entry.profileHref}
              className="flex items-center gap-3 px-4 py-3"
            >
              <span className="w-6 shrink-0 font-display text-lg font-extrabold text-ink-muted">
                {index + 1}
              </span>
              <Link
                href={entry.profileHref}
                className="flex min-w-0 flex-1 items-center gap-3 transition-opacity hover:opacity-80"
              >
                {entry.imageUrl ? (
                  <Image
                    src={entry.imageUrl}
                    alt=""
                    width={36}
                    height={36}
                    className="size-9 shrink-0 rounded-xl border-2 border-ink object-cover"
                  />
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-paper-muted font-display text-sm font-bold text-ink">
                    {entry.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="truncate font-semibold text-ink">
                  {entry.displayName}
                </span>
              </Link>
              <span className="shrink-0 font-display text-sm font-bold text-ink">
                {entry.value}{" "}
                <span className="font-sans font-medium text-ink-muted">
                  {unit}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function LeaderboardBoards({ boards }: { boards: Leaderboards }) {
  return (
    <div className="grid gap-10 md:grid-cols-3 md:gap-6">
      {BOARDS.map((board) => (
        <Board
          key={board.key}
          title={board.title}
          unit={board.unit}
          entries={boards[board.key]}
        />
      ))}
    </div>
  );
}
