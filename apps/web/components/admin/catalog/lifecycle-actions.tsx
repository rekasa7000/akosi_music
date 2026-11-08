"use client";

import { useState } from "react";
import { ArchiveIcon, ArchiveRestoreIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// Shared archive/restore/permanently-delete control for the catalog
// hierarchy (Artist/Release/Track) — one place for the confirm-dialog
// logic instead of four near-identical copies. Archive is one click
// (it's reversible via Restore); permanent delete always confirms,
// since it isn't.
type CascadeCounts = { releases?: number; tracks?: number; cards: number };

function describeCascade(counts: CascadeCounts): string {
  const parts: string[] = [];
  if (counts.releases) parts.push(`${counts.releases} release${counts.releases === 1 ? "" : "s"}`);
  if (counts.tracks) parts.push(`${counts.tracks} track${counts.tracks === 1 ? "" : "s"}`);
  if (counts.cards) parts.push(`${counts.cards} card${counts.cards === 1 ? "" : "s"}`);
  if (parts.length === 0) return "";
  return `This will also permanently delete ${parts.join(", ")}.`;
}

export function LifecycleMenu({
  deletedAt,
  itemLabel,
  getCascadeCounts,
  onArchive,
  onRestore,
  onDeletePermanently,
  size = "default",
  className,
}: {
  deletedAt: string | null;
  itemLabel: string;
  // Fetched lazily when the delete-permanently dialog opens, so the
  // admin sees exactly what else gets destroyed before confirming.
  getCascadeCounts?: () => Promise<CascadeCounts>;
  onArchive: () => Promise<void>;
  onRestore: () => Promise<void>;
  onDeletePermanently: () => Promise<void>;
  size?: "sm" | "default";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cascadeNote, setCascadeNote] = useState<string | null>(null);

  const iconSize = size === "sm" ? "size-3.5" : "size-4";
  const buttonSize = size === "sm" ? "size-7" : "size-8";

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePermanently(e: React.MouseEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onDeletePermanently();
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!deletedAt) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => run(onArchive)}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-akosi-muted-fg transition-colors hover:bg-akosi-fg/10 hover:text-akosi-fg disabled:opacity-60",
          buttonSize,
          className,
        )}
        title={`Archive ${itemLabel}`}
      >
        {busy ? <Loader2Icon className={cn(iconSize, "animate-spin")} /> : <ArchiveIcon className={iconSize} />}
        <span className="sr-only">Archive {itemLabel}</span>
      </button>
    );
  }

  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)}>
      <button
        type="button"
        disabled={busy}
        onClick={() => run(onRestore)}
        className={cn(
          "flex items-center justify-center rounded-full text-akosi-muted-fg transition-colors hover:bg-akosi-fg/10 hover:text-akosi-fg disabled:opacity-60",
          buttonSize,
        )}
        title={`Restore ${itemLabel}`}
      >
        {busy ? <Loader2Icon className={cn(iconSize, "animate-spin")} /> : <ArchiveRestoreIcon className={iconSize} />}
        <span className="sr-only">Restore {itemLabel}</span>
      </button>
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);
          if (!next) {
            setError(null);
            return;
          }
          setCascadeNote(null);
          getCascadeCounts?.().then((counts) => setCascadeNote(describeCascade(counts)));
        }}
      >
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center rounded-full text-akosi-muted-fg transition-colors hover:bg-akosi-accent-2/15 hover:text-akosi-accent-2",
              buttonSize,
            )}
            title={`Delete ${itemLabel} permanently`}
          >
            <Trash2Icon className={iconSize} />
            <span className="sr-only">Delete {itemLabel} permanently</span>
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {itemLabel} permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {cascadeNote ? `${cascadeNote} ` : null}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-akosi-accent-2">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={handleDeletePermanently}
              className="bg-akosi-accent-2! text-white! hover:bg-akosi-accent-2/90!"
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
