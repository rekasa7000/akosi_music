import type { ReactNode } from "react";
import { AkosiWordmark } from "./wordmark";
import { StageLight } from "./stage-light";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-16 font-sans text-akosi-fg">
      <StageLight />
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-10">
        <AkosiWordmark size="lg" priority />
        <div className="w-full rounded-md border border-akosi-fg/10 bg-akosi-surface/80 p-8 shadow-[0_0_60px_-15px] shadow-akosi-accent/30 backdrop-blur-sm">
          {children}
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
      <h1 className="font-display text-xl font-medium text-akosi-fg">{title}</h1>
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
