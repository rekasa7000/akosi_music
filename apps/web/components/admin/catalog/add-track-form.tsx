"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  ImagePlusIcon,
  Loader2Icon,
  MusicIcon,
  UploadCloudIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_AUDIO_UPLOAD_MB, MAX_VIDEO_UPLOAD_MB } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type MediaType = "AUDIO" | "VIDEO";

type CreateTrackParams = {
  title: string;
  mediaType: MediaType;
  rawStorageKey: string;
  trackNumber?: number;
  lyrics?: string;
  coverImageKey?: string;
};

// Injected rather than imported — lets this component serve both the
// admin portal (admin-api.ts) and the artist portal (artist-api.ts). T is
// whatever shape each client's createTrack resolves to; the caller already
// knows how to fold that into its own local state.
export function AddTrackForm<T>({
  releaseId,
  nextTrackNumber,
  uploadMedia,
  createTrack,
  onCreated,
}: {
  releaseId: string;
  nextTrackNumber: number;
  uploadMedia: (purpose: "track-audio" | "track-video" | "track-cover", file: File) => Promise<string>;
  createTrack: (releaseId: string, params: CreateTrackParams) => Promise<T>;
  onCreated: (track: T) => void;
}) {
  const [mediaType, setMediaType] = useState<MediaType>("AUDIO");
  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [draggingMedia, setDraggingMedia] = useState(false);
  const [draggingCover, setDraggingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const trackNumberRef = useRef<HTMLInputElement>(null);
  const lyricsRef = useRef<HTMLTextAreaElement>(null);

  function pickCover(f: File) {
    setCoverFile(f);
    setCoverPreviewUrl(URL.createObjectURL(f));
  }

  function pickMedia(f: File) {
    const maxMb = mediaType === "AUDIO" ? MAX_AUDIO_UPLOAD_MB : MAX_VIDEO_UPLOAD_MB;
    if (f.size > maxMb * 1024 * 1024) {
      setError(`That file is ${formatBytes(f.size)} — ${mediaType === "AUDIO" ? "audio" : "video"} files are limited to ${maxMb}MB.`);
      return;
    }
    setError(null);
    setFile(f);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Choose an audio or video file.");
      return;
    }
    const formEl = e.currentTarget;
    const title = titleRef.current?.value.trim() ?? "";
    const trackNumber = Number(trackNumberRef.current?.value);
    const lyrics = lyricsRef.current?.value.trim() ?? "";

    setError(null);
    setBusy(true);
    try {
      setStage(mediaType === "AUDIO" ? "Uploading audio…" : "Uploading video…");
      const rawStorageKey = await uploadMedia(
        mediaType === "AUDIO" ? "track-audio" : "track-video",
        file,
      );

      let coverImageKey: string | undefined;
      if (coverFile) {
        setStage("Uploading cover…");
        coverImageKey = await uploadMedia("track-cover", coverFile);
      }

      setStage("Saving track…");
      const track = await createTrack(releaseId, {
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
      setCoverPreviewUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  function onMediaDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDraggingMedia(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) pickMedia(dropped);
  }

  function onCoverDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setDraggingCover(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) pickCover(dropped);
  }

  const MediaIcon = mediaType === "AUDIO" ? MusicIcon : VideoIcon;

  return (
    <form
      className="space-y-6 rounded-xl border border-akosi-fg/10 bg-akosi-surface p-6 sm:p-8"
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="font-display text-base font-medium text-akosi-fg">Add a track</h3>
        <p className="mt-0.5 text-sm text-akosi-muted-fg">
          Upload the file, then fill in the details.
        </p>
      </div>

      <div className="inline-flex rounded-full border border-akosi-fg/10 bg-akosi-bg p-1">
        {(["AUDIO", "VIDEO"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setMediaType(type);
              setFile(null);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              mediaType === type
                ? "bg-akosi-accent text-white"
                : "text-akosi-muted-fg hover:text-akosi-fg",
            )}
          >
            {type === "AUDIO" ? <MusicIcon className="size-3.5" /> : <VideoIcon className="size-3.5" />}
            {type === "AUDIO" ? "Audio" : "Video"}
          </button>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={mediaType === "AUDIO" ? "audio/*" : "video/*"}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickMedia(f);
        }}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-akosi-fg/10 bg-akosi-bg px-4 py-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-akosi-accent/15 text-akosi-accent-2">
            <MediaIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-akosi-fg">{file.name}</p>
            <p className="text-xs text-akosi-muted-fg">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="shrink-0 rounded-full p-1.5 text-akosi-muted-fg hover:bg-akosi-fg/10 hover:text-akosi-fg"
          >
            <XIcon className="size-4" />
            <span className="sr-only">Remove file</span>
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDraggingMedia(true);
          }}
          onDragLeave={() => setDraggingMedia(false)}
          onDrop={onMediaDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
            draggingMedia
              ? "border-akosi-accent-2 bg-akosi-accent-2/10"
              : "border-akosi-fg/20 hover:border-akosi-fg/35",
          )}
        >
          <UploadCloudIcon className="size-7 text-akosi-muted-fg" strokeWidth={1.5} />
          <p className="text-sm text-akosi-fg">
            <span className="font-medium text-akosi-accent-2">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-akosi-muted-fg">
            {mediaType === "AUDIO"
              ? `MP3, WAV, FLAC… up to ${MAX_AUDIO_UPLOAD_MB}MB`
              : `MP4, MOV… up to ${MAX_VIDEO_UPLOAD_MB}MB`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_7rem]">
        <div className="space-y-1.5">
          <Label htmlFor="track-title">Title</Label>
          <Input id="track-title" ref={titleRef} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="track-number">Track #</Label>
          <Input
            id="track-number"
            ref={trackNumberRef}
            type="number"
            min={1}
            defaultValue={nextTrackNumber}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="shrink-0">
          <Label className="mb-1.5 block">Cover (optional)</Label>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickCover(f);
            }}
          />
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDraggingCover(true);
            }}
            onDragLeave={() => setDraggingCover(false)}
            onDrop={onCoverDrop}
            className={cn(
              "group relative size-24 overflow-hidden rounded-md border transition-colors",
              draggingCover
                ? "border-akosi-accent-2 bg-akosi-accent-2/10"
                : "border-dashed border-akosi-fg/20 hover:border-akosi-fg/35",
              coverPreviewUrl && "border-solid border-akosi-fg/10",
            )}
          >
            {coverPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreviewUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-akosi-muted-fg">
                <ImagePlusIcon className="size-5" strokeWidth={1.5} />
              </div>
            )}
          </button>
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="track-lyrics">Lyrics (optional)</Label>
          <Textarea id="track-lyrics" ref={lyricsRef} rows={4} className="resize-none" />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-akosi-accent-2">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={busy}
          className="bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              {stage ?? "Saving…"}
            </>
          ) : (
            "Add track"
          )}
        </Button>
      </div>
    </form>
  );
}
