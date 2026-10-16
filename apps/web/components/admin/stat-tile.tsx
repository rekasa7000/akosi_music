import { cn } from "@/lib/utils";

export function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: "accent" | "accent-2";
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-akosi-fg/10 bg-akosi-surface p-5">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1.5",
          accent === "accent" ? "bg-akosi-accent" : "bg-akosi-accent-2",
        )}
      />
      <div
        className={cn(
          "mb-3 flex size-10 items-center justify-center rounded-lg",
          accent === "accent"
            ? "bg-akosi-accent/15 text-akosi-accent"
            : "bg-akosi-accent-2/15 text-akosi-accent-2",
        )}
      >
        <Icon className="size-5" />
      </div>
      <p className="font-display text-4xl font-bold text-akosi-fg">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-akosi-muted-fg">{label}</p>
    </div>
  );
}
