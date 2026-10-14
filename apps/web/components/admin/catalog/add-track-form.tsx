"use client";

import { useState, type FormEvent } from "react";
import * as api from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AddTrackForm({
  releaseId,
  nextTrackNumber,
  onCreated,
}: {
  releaseId: string;
  nextTrackNumber: number;
  onCreated: (track: api.Track) => void;
}) {
  const [mediaType, setMediaType] = useState<api.MediaType>("AUDIO");
  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Choose an audio or video file.");
      return;
    }
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const title = String(form.get("title") ?? "").trim();
    const trackNumber = Number(form.get("trackNumber"));
    const lyrics = String(form.get("lyrics") ?? "").trim();

    setError(null);
    setBusy(true);
    try {
      setStage(mediaType === "AUDIO" ? "Uploading audio…" : "Uploading video…");
      const rawStorageKey = await api.uploadMedia(
        mediaType === "AUDIO" ? "track-audio" : "track-video",
        file,
      );

      let coverImageKey: string | undefined;
      if (coverFile) {
        setStage("Uploading cover…");
        coverImageKey = await api.uploadMedia("track-cover", coverFile);
      }

      setStage("Saving track…");
      const track = await api.createTrack(releaseId, {
        title,
        mediaType,
        rawStorageKey,
        trackNumber: Number.isFinite(trackNumber) && trackNumber > 0 ? trackNumber : undefined,
        lyrics: lyrics || undefined,
        coverImageKey,
      });
      onCreated(track);
      formEl.reset();
      setFile(null);
      setCoverFile(null);
    } catch (err) {
      setError(err instanceof api.AdminApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  return (
    <form
      className="space-y-4 rounded-md border border-akosi-fg/10 bg-akosi-surface p-5"
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="track-title">Title</Label>
          <Input id="track-title" name="title" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="track-number">Track #</Label>
          <Input
            id="track-number"
            name="trackNumber"
            type="number"
            min={1}
            defaultValue={nextTrackNumber}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="track-media-type">Media type</Label>
        <Select value={mediaType} onValueChange={(v) => setMediaType(v as api.MediaType)}>
          <SelectTrigger id="track-media-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AUDIO">Audio</SelectItem>
            <SelectItem value="VIDEO">Video</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="track-file">{mediaType === "AUDIO" ? "Audio file" : "Video file"}</Label>
        <Input
          id="track-file"
          type="file"
          accept={mediaType === "AUDIO" ? "audio/*" : "video/*"}
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="track-cover">Cover image (optional)</Label>
        <Input
          id="track-cover"
          type="file"
          accept="image/*"
          onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="track-lyrics">Lyrics (optional)</Label>
        <Textarea id="track-lyrics" name="lyrics" rows={4} />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-akosi-accent-2">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={busy}
        className="bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60"
      >
        {busy ? stage ?? "Saving…" : "Add track"}
      </Button>
    </form>
  );
}
