import type { ReactNode } from "react";
import { AkosiWordmark } from "./wordmark";
import { StageLight } from "./stage-light";
import { ThemeToggle } from "./theme-toggle";
import { FoilCard } from "@/components/landing/foil-card";
import { FOIL_SWEEPS } from "@/lib/foil-sweeps";
import { cn } from "@/lib/utils";

// The backstage door: the StageLight stays the page's one ambient
// moment, and the emptiness around the card is dressed with static
// layers only — grain, a giant cropped outline word, and tilted foil
// cards waiting in the wings. All of it aria-hidden and
// pointer-events-none; the form inside stays a calm data zone.
export function AuthShell({
  eyebrow = "akosi · backstage",
  children,
}: {
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-16 font-sans text-akosi-fg">
      <StageLight />

      {/* The wings — cards scattered just offstage. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <FoilCard
          sweep="plum"
          rotate={-12}
          className="absolute top-[12%] -left-24 hidden w-80 opacity-50 blur-[2px] md:block"
        />
        <FoilCard
          sweep="flare"
          rotate={9}
          className="absolute -right-28 bottom-[18%] hidden w-80 opacity-50 blur-[2px] md:block"
        />
        <FoilCard
          sweep="ember"
          rotate={14}
          className="absolute -top-10 right-[8%] w-44 opacity-35 blur-[1px] md:w-56"
        />
        <FoilCard
          sweep="plum"
          rotate={-8}
          className="absolute -bottom-12 left-[6%] w-40 opacity-35 blur-[1px] md:hidden"
        />
      </div>

      <span
        aria-hidden="true"
        className="akosi-header-word pointer-events-none absolute bottom-[-0.3em] left-1/2 -translate-x-1/2 text-[clamp(6rem,26vw,18rem)] whitespace-nowrap select-none"
      >
        akosi
      </span>
      <div aria-hidden="true" className="akosi-grain pointer-events-none absolute inset-0" />

      <ThemeToggle className="absolute top-4 right-4 z-10" />

      <div className="akosi-rise relative flex w-full max-w-sm flex-col items-center gap-8">
        <AkosiWordmark size="lg" priority />
        <div className="w-full overflow-hidden rounded-3xl border-2 border-akosi-fg/15 bg-akosi-surface/90 shadow-[8px_8px_0_0_var(--akosi-plum-shadow)] backdrop-blur-sm">
          {/* Foil-sweep top edge — the same fixed card ink as StatTile. */}
          <div aria-hidden="true" className="h-1.5" style={{ background: FOIL_SWEEPS[0] }} />
          <div className="p-6 sm:p-8">
            <p className="mb-5 font-display text-xs font-semibold tracking-[0.2em] text-akosi-accent-2 uppercase">
              {eyebrow}
            </p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 space-y-1.5">
      <h1 className="font-display text-3xl leading-[0.95] font-bold tracking-tight lowercase text-akosi-fg">
        {title}
      </h1>
      {description ? (
        <p className="text-sm text-akosi-muted-fg">{description}</p>
      ) : null}
    </div>
  );
}

const SETUP_STEPS = ["email", "verify", "password", "authenticator"] as const;

export function SetupProgress({ index }: { index: number }) {
  return (
    <div className="mb-8 flex items-center gap-1.5">
      {SETUP_STEPS.map((label, i) => (
        <div key={label} className="flex-1">
          <div
            className={cn(
              "h-0.75 rounded-full transition-colors duration-500",
              i <= index ? "bg-akosi-accent-2" : "bg-akosi-fg/15",
            )}
          />
        </div>
      ))}
    </div>
  );
}
