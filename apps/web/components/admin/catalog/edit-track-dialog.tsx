"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CoverUploader } from "@/components/admin/catalog/cover-uploader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type EditableTrack = {
  id: string;
  title: string;
  trackNumber: number | null;
  lyrics: string | null;
  coverImageKey: string | null;
};

type UpdateTrackParams = {
  title?: string;
  trackNumber?: number;
  lyrics?: string;
  coverImageKey?: string;
};

// Injected rather than imported — same reuse story as AddTrackForm/
// CoverUploader. T must carry at least EditableTrack's fields; admin's
// api.TrackSummary (cardCount/locked extras) and a future artist Track
// type both satisfy that structurally.
export function EditTrackDialog<T extends EditableTrack>({
  track,
  open,
  onOpenChange,
  onUpdated,
  uploadMedia,
  updateTrack,
}: {
  track: T;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (track: T) => void;
  uploadMedia: (purpose: "track-cover", file: File) => Promise<string>;
  updateTrack: (id: string, params: UpdateTrackParams) => Promise<Partial<T> & { coverImageKey: string | null }>;
}) {
  const [title, setTitle] = useState(track.title);
  const [trackNumber, setTrackNumber] = useState(track.trackNumber?.toString() ?? "");
  const [lyrics, setLyrics] = useState(track.lyrics ?? "");
  const [coverImageKey, setCoverImageKey] = useState(track.coverImageKey);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const updated = await updateTrack(track.id, {
        title,
        trackNumber: trackNumber ? Number(trackNumber) : undefined,
        lyrics,
      });
      onUpdated({ ...track, ...updated, coverImageKey });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCoverUploaded(key: string) {
    const updated = await updateTrack(track.id, { coverImageKey: key });
    setCoverImageKey(updated.coverImageKey);
    onUpdated({ ...track, ...updated });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setTitle(track.title);
          setTrackNumber(track.trackNumber?.toString() ?? "");
          setLyrics(track.lyrics ?? "");
          setError(null);
        }
      }}
    >
      <DialogContent className="bg-akosi-surface text-akosi-fg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Edit track</DialogTitle>
          <DialogDescription>Update title, track number, cover, and lyrics.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex gap-4">
            <div className="shrink-0">
              <Label className="mb-1.5 block">Cover</Label>
              <CoverUploader
                purpose="track-cover"
                currentKey={coverImageKey}
                size="sm"
                uploadMedia={uploadMedia}
                onUploaded={handleCoverUploaded}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-track-title">Title</Label>
                <Input
                  id="edit-track-title"
                  required
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-track-number">Track #</Label>
                <Input
                  id="edit-track-number"
                  type="number"
                  min={1}
                  value={trackNumber}
                  onChange={(e) => setTrackNumber(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-track-lyrics">Lyrics</Label>
            <Textarea
              id="edit-track-lyrics"
              rows={6}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="No lyrics yet…"
            />
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
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
