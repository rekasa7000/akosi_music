"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2Icon, LayersIcon, TriangleAlertIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TrackCombobox } from "@/components/admin/catalog/track-combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function parseCodes(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function BulkCreateCardsDialog({
  tracks,
  onCreated,
}: {
  tracks: api.TrackPickerEntry[];
  onCreated: (cards: api.Card[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "");
  const [editionLabel, setEditionLabel] = useState("");
  const [rawCodes, setRawCodes] = useState("");
  const [genPrefix, setGenPrefix] = useState("AKOSI");
  const [genCount, setGenCount] = useState("50");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<api.BulkCreateCardsResult | null>(null);

  const codes = useMemo(() => parseCodes(rawCodes), [rawCodes]);

  function reset() {
    setEditionLabel("");
    setRawCodes("");
    setError(null);
    setResult(null);
  }

  function generateCodes() {
    const count = Math.max(1, Math.min(500, Number(genCount) || 0));
    const prefix = genPrefix.trim() || "AKOSI";
    const existing = parseCodes(rawCodes);
    const start = existing.length + 1;
    const generated = Array.from({ length: count }, (_, i) =>
      `${prefix}-${String(start + i).padStart(4, "0")}`,
    );
    setRawCodes([...existing, ...generated].join("\n"));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!trackId) {
      setError("Choose a track first.");
      return;
    }
    if (codes.length === 0) {
      setError("Add at least one card code.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await api.createCardsBulk({
        trackId,
        uids: codes,
        editionLabel: editionLabel.trim() || undefined,
      });
      onCreated(res.created);
      setResult(res);
    } catch (err) {
      setError(err instanceof api.AdminApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={tracks.length === 0}
          className="border-akosi-fg/15 bg-transparent! text-akosi-fg! hover:bg-akosi-fg/10!"
        >
          <LayersIcon className="size-4" />
          Bulk add
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-akosi-surface text-akosi-fg sm:max-w-lg">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Bulk add results</DialogTitle>
              <DialogDescription>
                {result.created.length} card{result.created.length === 1 ? "" : "s"} created
                {result.skipped.length > 0
                  ? `, ${result.skipped.length} skipped`
                  : ""}
                .
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-72 space-y-3 overflow-y-auto">
              {result.created.length > 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
                  <p>
                    {result.created.length} card{result.created.length === 1 ? "" : "s"} provisioned for{" "}
                    {result.created[0]?.trackTitle}.
                  </p>
                </div>
              ) : null}
              {result.skipped.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-akosi-accent-2/30 bg-akosi-accent-2/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-akosi-accent-2">
                    <TriangleAlertIcon className="size-4 shrink-0" />
                    Skipped
                  </div>
                  <ul className="space-y-1 text-xs text-akosi-muted-fg">
                    {result.skipped.map((s) => (
                      <li key={s.uid} className="font-mono">
                        {s.uid} — {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => setOpen(false)}
                className="bg-akosi-accent! text-white! hover:bg-akosi-accent-2!"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Bulk add cards</DialogTitle>
              <DialogDescription>
                Provision many pre-printed codes against one track in a single pass.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="bulk-card-track">Track</Label>
                <TrackCombobox tracks={tracks} value={trackId} onChange={setTrackId} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bulk-card-edition">Edition label (optional, applies to all)</Label>
                <Input
                  id="bulk-card-edition"
                  value={editionLabel}
                  onChange={(e) => setEditionLabel(e.target.value)}
                  placeholder="Launch edition"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-end justify-between gap-2">
                  <Label htmlFor="bulk-card-codes">
                    Card codes {codes.length > 0 ? `(${codes.length})` : ""}
                  </Label>
                </div>
                <Textarea
                  id="bulk-card-codes"
                  value={rawCodes}
                  onChange={(e) => setRawCodes(e.target.value)}
                  placeholder={"One code per line —\nAKOSI-0001\nAKOSI-0002\nAKOSI-0003"}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-end gap-2 rounded-lg border border-dashed border-akosi-fg/15 p-3">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="bulk-gen-prefix" className="text-xs text-akosi-muted-fg">
                    No codes printed yet? Generate some
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="bulk-gen-prefix"
                      value={genPrefix}
                      onChange={(e) => setGenPrefix(e.target.value)}
                      placeholder="Prefix"
                      className="w-28"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={genCount}
                      onChange={(e) => setGenCount(e.target.value)}
                      className="w-20"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generateCodes}
                      className="shrink-0 border-akosi-fg/15 bg-transparent! text-akosi-fg! hover:bg-akosi-fg/10!"
                    >
                      Generate
                    </Button>
                  </div>
                </div>
              </div>

              {error ? (
                <p role="alert" className="text-sm text-akosi-accent-2">
                  {error}
                </p>
              ) : null}
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={busy || codes.length === 0}
                  className="bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60"
                >
                  {busy
                    ? "Provisioning…"
                    : `Create ${codes.length || ""} card${codes.length === 1 ? "" : "s"}`}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
