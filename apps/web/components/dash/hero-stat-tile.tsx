import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Full foil sweeps for hero tiles — the same fixed card-ink gradients
// as FoilCard, used as whole backgrounds here (vs StatTile's thin top
// bar). Ink sits over the dark end of each sweep behind a scrim, so
// the big numeral stays readable on every sweep in both modes.
const SWEEPS = {
  ember: "linear-gradient(135deg, #7a1f1a 0%, #c23b2e 35%, #ff8a3d 70%, #ffd8a8 100%)",
  plum: "linear-gradient(135deg, #3d0f1f 0%, #5c1a2e 30%, #c23b2e 70%, #ff8a3d 100%)",
  flare: "linear-gradient(135deg, #7a1f1a 0%, #c23b2e 40%, #ff8a3d 80%, #ffd8a8 100%)",
} as const;

export function formatStat(value: number): string {
  return value.toLocaleString("en-US");
}

export function HeroStatTile({
  label,
  value,
  icon: Icon,
  sweep = "ember",
  tilt = 0,
  // The ≤5%-per-screen pop: exactly one tile per view gets this — a
  // highlight-ink ring and a teal "live" stamp with fixed #241013 ink.
  highlight = false,
  highlightNote,
  delay = 0,
}: {
  label: string;
  value: number;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  sweep?: keyof typeof SWEEPS;
  // Collage tilt, desktop only — mobile tiles sit flat in the snap row.
  tilt?: -2 | -1 | 0 | 1 | 2;
  highlight?: boolean;
  highlightNote?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn(
        "group akosi-rise relative min-w-[72%] snap-start overflow-hidden rounded-2xl p-5 text-[#fff4e4] transition-transform duration-300 sm:min-w-0 lg:hover:rotate-0",
        "shadow-[6px_6px_0_0_var(--akosi-plum-shadow)]",
        tilt === -2 && "lg:-rotate-2",
        tilt === -1 && "lg:-rotate-1",
        tilt === 1 && "lg:rotate-1",
        tilt === 2 && "lg:rotate-2",
        highlight && "ring-2 ring-akosi-highlight-ink ring-offset-2 ring-offset-akosi-bg",
      )}
      style={{ background: SWEEPS[sweep], animationDelay: `${delay}ms` }}
    >
      {/* Scrim pins the dark end under the text so the numeral keeps
          AA contrast wherever the sweep lands. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-black/45 via-black/20 to-transparent"
      />
      <div
        aria-hidden="true"
        className="akosi-foil-shine pointer-events-none absolute inset-0"
      />
      {Icon ? (
        <span aria-hidden="true" className="pointer-events-none absolute -right-4 -bottom-6">
          <Icon className="size-24 text-white/10" strokeWidth={1} />
        </span>
      ) : null}
      <div className="relative">
        <p className="font-display text-xs font-semibold tracking-[0.18em] uppercase opacity-90">
          {label}
        </p>
        <p className="mt-2 font-display text-[clamp(2.5rem,6vw,3.25rem)] leading-none font-bold tabular-nums">
          {formatStat(value)}
        </p>
        {highlight && highlightNote ? (
          <span className="mt-3 inline-block -rotate-2 rounded-md bg-akosi-highlight px-2 py-0.5 font-display text-[11px] font-bold tracking-wide text-[#241013] uppercase">
            {highlightNote}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// 4-up (or 3-up) on desktop, 2-up on small tablets, a swipeable
// scroll-snap row on phones — the tiles set min-width for the snap case.
export function HeroStatRow({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 }) {
  return (
    <div
      className={cn(
        "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-1 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0",
        cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}
