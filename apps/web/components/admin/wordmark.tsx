import { cn } from "@/lib/utils";

export function AkosiWordmark({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-display font-medium lowercase tracking-tight text-akosi-fg",
        size === "lg" ? "gap-1.5 text-4xl sm:text-5xl" : "gap-1 text-xl",
        className,
      )}
    >
      akosi
      <span className="text-akosi-accent-2" aria-hidden="true">
        ♪
      </span>
      music
    </span>
  );
}
