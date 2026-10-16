import { NfcIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// The one recurring visual motif on the landing page — a stylized
// take on the physical card itself, not a generic gradient panel.
// Fixed, saturated colors regardless of light/dark: a printed card's
// ink doesn't change with the room lighting.
const SWEEPS = {
  ember: "linear-gradient(135deg, #7a1f1a 0%, #c23b2e 35%, #ff8a3d 70%, #ffd8a8 100%)",
  plum: "linear-gradient(135deg, #3d0f1f 0%, #5c1a2e 30%, #c23b2e 70%, #ff8a3d 100%)",
  flare: "linear-gradient(135deg, #c23b2e 0%, #ff8a3d 45%, #ffd8a8 75%, #fff4e4 100%)",
} as const;

export function FoilCard({
  sweep = "ember",
  rotate = 0,
  className,
}: {
  sweep?: keyof typeof SWEEPS;
  rotate?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("relative aspect-[8/5] w-full rounded-[1.25rem]", className)}
      style={{
        background: SWEEPS[sweep],
        transform: `rotate(${rotate}deg)`,
        boxShadow: "0 30px 70px -20px rgba(20,5,5,0.55), 0 2px 0 rgba(255,255,255,0.25) inset",
      }}
    >
      <div className="absolute inset-0 rounded-[1.25rem] bg-linear-to-br from-white/35 via-transparent to-black/10" />
      <div className="absolute top-[14%] left-[8%] h-[16%] w-[15%] rounded-[0.3rem] bg-black/25 ring-1 ring-white/30" />
      <NfcIcon className="absolute top-[14%] right-[8%] size-[13%] text-white/80" strokeWidth={1.75} />
      <span className="absolute bottom-[12%] left-[8%] font-display text-[13%] leading-none font-medium text-white">
        akosi <span aria-hidden>♪</span>
      </span>
    </div>
  );
}
