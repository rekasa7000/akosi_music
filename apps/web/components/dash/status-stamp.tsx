import { cn } from "@/lib/utils";

// Stamp/sticker status badges — slightly rotated, squared corners,
// display type. Tones map to the fixed roles; "highlight" is reserved
// for live/new moments (teal, fixed #241013 ink) and counts toward the
// one-highlight-per-view budget.
const TONES = {
  accent: "border-akosi-accent bg-akosi-accent text-white",
  "accent-2": "border-akosi-accent-2/70 bg-transparent text-akosi-accent-2 border-dashed",
  muted: "border-akosi-fg/25 bg-transparent text-akosi-muted-fg",
  highlight: "border-transparent bg-akosi-highlight text-[#241013]",
} as const;

export type StampTone = keyof typeof TONES;

export const CARD_STATUS_TONE: Record<string, StampTone> = {
  CLAIMED: "accent",
  UNCLAIMED: "accent-2",
  REVOKED: "muted",
  READY: "accent",
  PROCESSING: "accent-2",
  FAILED: "muted",
};

export function StatusStamp({
  tone = "muted",
  children,
  rotate = true,
  className,
}: {
  tone?: StampTone;
  children: React.ReactNode;
  // Data zones (table rows) keep stamps flat; framing areas tilt them.
  rotate?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border-2 px-1.5 py-0.5 font-display text-[11px] leading-4 font-bold tracking-wide uppercase",
        TONES[tone],
        rotate && "-rotate-2",
        className,
      )}
    >
      {children}
    </span>
  );
}
