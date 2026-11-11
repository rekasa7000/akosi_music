"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type TrendPoint = { date: string; plays: number };

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Calm data zone — no grain, no tilt, no gradient behind marks. One
// series (the title names it, so no legend), recessive gridlines, a
// direct label on the peak day only, and a hover/tap tooltip per bar.
// Columns are full-height buttons, so the touch target is the whole
// column, not the thin bar.
export function TrendChart({ data, title }: { data: TrendPoint[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.plays), 1);
  const peak = data.reduce((best, d, i) => (d.plays > data[best].plays ? i : best), 0);
  const hasAny = data.some((d) => d.plays > 0);

  return (
    <div className="rounded-2xl border-2 border-akosi-fg/15 bg-akosi-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-base font-medium">{title}</p>
        <p className="text-xs text-akosi-muted-fg tabular-nums">peak {max.toLocaleString()}</p>
      </div>

      {!hasAny ? (
        <p className="mt-4 text-sm text-akosi-muted-fg">No plays in the last 14 days.</p>
      ) : (
        <div className="relative mt-4">
          {/* Recessive gridlines behind the columns. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 bottom-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute inset-x-0 border-t border-akosi-fg/10"
                style={{ top: `${(i / 3) * 100}%` }}
              />
            ))}
          </div>

          <div className="flex h-44 items-stretch gap-0.75" role="img" aria-hidden="true">
            {data.map((d, i) => (
              <button
                key={d.date}
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((prev) => (prev === i ? null : prev))}
                onClick={() => setActive((prev) => (prev === i ? null : i))}
                className="relative flex min-w-0 flex-1 flex-col justify-end pb-6"
              >
                {active === i ? (
                  <span className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md border border-akosi-fg/15 bg-akosi-surface px-2 py-1 text-xs font-medium whitespace-nowrap shadow-sm tabular-nums">
                    {dayLabel(d.date)} · {d.plays.toLocaleString()}
                  </span>
                ) : null}
                {i === peak && d.plays > 0 ? (
                  <span className="mb-1 text-center text-xs font-semibold text-akosi-fg tabular-nums">
                    {d.plays.toLocaleString()}
                  </span>
                ) : null}
                {d.plays > 0 ? (
                  <span
                    className={cn(
                      "block w-full rounded-t-[4px] bg-akosi-chart-1 transition-opacity",
                      active !== null && active !== i && "opacity-60",
                    )}
                    style={{ height: `${Math.max((d.plays / max) * 100, 3)}%` }}
                  />
                ) : (
                  <span className="block h-px w-full bg-akosi-fg/15" />
                )}
                <span
                  className={cn(
                    "absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-akosi-muted-fg",
                    // Three ticks only (first / middle / last) — denser
                    // labels collide once the chart sits in a sidebar
                    // or phone column, and the tooltip names every day.
                    i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)
                      ? ""
                      : "hidden",
                  )}
                >
                  {dayLabel(d.date)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Screen-reader table view of the same series. */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Plays</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{dayLabel(d.date)}</th>
              <td>{d.plays}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
