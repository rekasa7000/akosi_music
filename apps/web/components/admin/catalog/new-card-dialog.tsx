"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewCardDialog({
  tracks,
  onCreated,
}: {
  tracks: api.TrackPickerEntry[];
  onCreated: (card: api.Card) => void;
}) {
  const [open, setOpen] = useState(false);
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!trackId) {
      setError("Choose a track first.");
      return;
    }
    const form = new FormData(e.currentTarget);
    const uid = String(form.get("uid") ?? "").trim();
    const editionLabel = String(form.get("editionLabel") ?? "").trim();

    setError(null);
    setBusy(true);
    try {
      const card = await api.createCard({ uid, trackId, editionLabel: editionLabel || undefined });
      onCreated(card);
      setOpen(false);
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
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          disabled={tracks.length === 0}
          className="bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60"
        >
          <PlusIcon className="size-4" />
          New card
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-akosi-surface text-akosi-fg">
        <DialogHeader>
          <DialogTitle className="font-display">Provision a card</DialogTitle>
          <DialogDescription>
            Type in the code printed on the physical card and assign it to a track.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="card-track">Track</Label>
            <Select value={trackId} onValueChange={setTrackId}>
              <SelectTrigger id="card-track" className="w-full">
                <SelectValue placeholder="Choose a track" />
              </SelectTrigger>
              <SelectContent>
                {tracks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title} — {t.releaseTitle} ({t.artistName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-uid">Card code</Label>
            <Input
              id="card-uid"
              name="uid"
              required
              autoFocus
              placeholder="AKOSI-0001"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-edition">Edition label (optional)</Label>
            <Input id="card-edition" name="editionLabel" placeholder="Launch edition" />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-akosi-accent-2">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="submit"
              disabled={busy}
              className="bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60"
            >
              {busy ? "Provisioning…" : "Create card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
