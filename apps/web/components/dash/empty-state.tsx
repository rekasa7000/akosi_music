import type { ReactNode } from "react";
import { FoilCard } from "@/components/landing/foil-card";
import { cn } from "@/lib/utils";

// Full expressive treatment for the "nothing here yet" moment: foil
// card illustration, oversized display type, one clear CTA. Honest by
// design — these screens carry the ambition for data that doesn't
// exist yet (orders, payouts, fans), so the copy states what's true
// now, never a fabricated preview number.
export function EmptyState({
  title,
  body,
  cta,
  sweep = "ember",
  className,
}: {
  title: string;
  body: string;
  // Exactly one action — or none for view-only surfaces.
  cta?: ReactNode;
  sweep?: "ember" | "plum" | "flare";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border-2 border-dashed border-akosi-fg/20 bg-akosi-surface px-6 py-12 text-center sm:py-16",
        className,
      )}
    >
      <div aria-hidden="true" className="akosi-grain pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        <div aria-hidden="true" className="akosi-ticket w-36 sm:w-44">
          <FoilCard sweep={sweep} rotate={-4} />
        </div>
        <h2 className="mt-8 font-display text-[clamp(1.5rem,5vw,2.25rem)] leading-[0.95] font-bold tracking-tight lowercase">
          {title}
        </h2>
        <p className="mt-3 text-base text-akosi-muted-fg">{body}</p>
        {cta ? <div className="mt-6">{cta}</div> : null}
      </div>
    </div>
  );
}
