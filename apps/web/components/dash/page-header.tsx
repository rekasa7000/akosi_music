import type { ReactNode } from "react";
import { StageLight } from "@/components/admin/stage-light";
import { cn } from "@/lib/utils";

// The maximalist frame for every dashboard page: the drifting stage
// light (the page's one ambient moment), a giant cropped background
// word in outlined display type, and a film-grain overlay. Everything
// decorative is aria-hidden and pointer-events-none — the data below
// this frame stays clean.
export function PageHeader({
  eyebrow,
  title,
  description,
  word,
  actions,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  // The oversized cropped background word — defaults to the title.
  word?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border-2 border-akosi-fg/15",
        className,
      )}
    >
      <StageLight />
      <span
        aria-hidden="true"
        className="akosi-header-word pointer-events-none absolute -right-2 bottom-[-0.35em] text-[clamp(5rem,22vw,13rem)] whitespace-nowrap select-none"
      >
        {word ?? title}
      </span>
      <div aria-hidden="true" className="akosi-grain pointer-events-none absolute inset-0" />
      <div className="relative flex flex-wrap items-end justify-between gap-4 px-5 py-8 sm:px-8 sm:py-10">
        <div className="min-w-0">
          <p className="font-display text-xs font-semibold tracking-[0.2em] text-akosi-accent-2 uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-1 font-display text-[clamp(2.25rem,7vw,3.5rem)] leading-[0.95] font-bold tracking-tight lowercase">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-prose text-base text-akosi-muted-fg">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
