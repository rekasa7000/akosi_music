import { cn } from "@/lib/utils";

// Same ember/flare gradient family as the landing page's FoilCard —
// a stat tile is a smaller, flatter stamp of the same physical-card
// motif, not an unrelated SaaS accent bar.
const SWEEPS = {
  accent: "linear-gradient(90deg, #7a1f1a 0%, #c23b2e 45%, #ff8a3d 100%)",
  "accent-2": "linear-gradient(90deg, #c23b2e 0%, #ff8a3d 55%, #ffd8a8 100%)",
} as const;

export function StatTile({
  icon: Icon,
  label,
  value,
  accent,
  tilt = 0,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number;
  accent: "accent" | "accent-2";
  // Resting collage tilt that settles flat on hover — same idea as
  // the landing page's rotated card art, applied sparingly (one or
  // two tiles, not every tile) rather than a rigid grid.
  tilt?: -1 | 0 | 1;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border-2 border-akosi-fg/15 bg-akosi-surface p-5 transition-transform duration-300 hover:-translate-y-1 hover:rotate-0",
        tilt === -1 && "-rotate-1",
        tilt === 1 && "rotate-1",
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-2"
        style={{ background: SWEEPS[accent] }}
        aria-hidden="true"
      />
      <span className="pointer-events-none absolute -right-3 -bottom-5" aria-hidden="true">
        <Icon className="size-24 text-akosi-fg/5" strokeWidth={1} />
      </span>
      <div
        className="relative mb-3 flex size-10 items-center justify-center rounded-full text-white"
        style={{ background: SWEEPS[accent] }}
      >
        <Icon className="size-5" />
      </div>
      <p className="relative font-display text-4xl font-bold text-akosi-fg">{value}</p>
      <p className="relative mt-0.5 text-sm font-medium text-akosi-muted-fg">{label}</p>
    </div>
  );
}
