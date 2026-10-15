"use client";

import { useState, type FormEvent } from "react";
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

export function NewReleaseDialog({
  artists,
  onCreated,
}: {
  artists: api.Artist[];
  onCreated: (release: api.Release) => void;
}) {
  const [open, setOpen] = useState(false);
  const [artistId, setArtistId] = useState<string>(artists[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = String(new FormData(e.currentTarget).get("title") ?? "").trim();
    if (!artistId) {
      setError("Choose an artist first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const release = await api.createRelease({ artistId, title });
      onCreated(release);
      setOpen(false);
    } catch (err) {
      setError(err instanceof api.AdminApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={artists.length === 0}
          className="bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60"
        >
          New release
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-akosi-surface text-akosi-fg">
        <DialogHeader>
          <DialogTitle className="font-display">New release</DialogTitle>
          <DialogDescription>Add tracks after creating it, then gate any of them with a card.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="release-artist">Artist</Label>
            <Select value={artistId} onValueChange={setArtistId}>
              <SelectTrigger id="release-artist" className="w-full">
                <SelectValue placeholder="Choose an artist" />
              </SelectTrigger>
              <SelectContent>
                {artists.map((artist) => (
                  <SelectItem key={artist.id} value={artist.id}>
                    {artist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="release-title">Title</Label>
            <Input id="release-title" name="title" required autoFocus />
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
              {busy ? "Creating…" : "Create release"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
