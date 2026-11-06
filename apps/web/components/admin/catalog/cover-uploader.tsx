"use client";

import { useRef, useState, type DragEvent } from "react";
import { CameraIcon, ImagePlusIcon, Loader2Icon } from "lucide-react";
import { formatMb, MAX_IMAGE_UPLOAD_MB } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = { lg: "max-w-64", sm: "max-w-36", xs: "max-w-28" } as const;
const ASPECT_CLASSES = { square: "aspect-square", banner: "aspect-[3/1]" } as const;

// Purpose-agnostic: admin and artist clients each define their own
// MediaUploadPurpose union (artist's is narrower — no artist-profile/
// artist-cover). Generic over P rather than a fixed union so each call
// site's own purpose literal — and the narrower uploadMedia function
// that actually accepts it — type-checks without widening either
// client's purpose type to match the other.
export type CoverUploadPurpose = "release-cover" | "track-cover" | "artist-profile" | "artist-cover";

export function CoverUploader<P extends string>({
  purpose,
  currentKey = null,
  currentUrl = null,
  onUploaded,
  uploadMedia,
  size = "lg",
  aspect = "square",
  shape = "rounded",
}: {
  purpose: P;
  // Raw storage key — release/track covers only have this (no
  // resolved URL from those endpoints yet), so it's just a "there's
  // something uploaded" signal behind a generic placeholder.
  currentKey?: string | null;
  // A presigned URL ready to render directly — when provided, shows
  // the real existing image instead of the placeholder.
  currentUrl?: string | null;
  onUploaded: (key: string) => Promise<void>;
  // Injected rather than imported — lets this component serve both the
  // admin portal (admin-api.ts) and the artist portal (artist-api.ts)
  // without either one knowing about the other's session/cookie.
  uploadMedia: (purpose: P, file: File) => Promise<string>;
  size?: "lg" | "sm" | "xs";
  aspect?: "square" | "banner";
  shape?: "rounded" | "circle";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (file.size > MAX_IMAGE_UPLOAD_MB * 1024 * 1024) {
      setError(`That image is ${formatMb(file.size)}MB — the limit is ${MAX_IMAGE_UPLOAD_MB}MB.`);
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);

    setError(null);
    setBusy(true);
    try {
      const key = await uploadMedia(purpose, file);
      await onUploaded(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const displayUrl = previewUrl ?? currentUrl;
  const hasExisting = Boolean(displayUrl) || Boolean(currentKey);

  return (
    <div className={cn("w-full", SIZE_CLASSES[size], aspect === "banner" && "max-w-none")}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "group relative w-full overflow-hidden border transition-colors",
          shape === "circle" ? "rounded-full" : "rounded-lg",
          ASPECT_CLASSES[aspect],
          dragging
            ? "border-akosi-accent-2 bg-akosi-accent-2/10"
            : "border-dashed border-akosi-fg/20 bg-akosi-surface hover:border-akosi-fg/35",
          hasExisting && "border-solid border-akosi-fg/10",
        )}
      >
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt="" className="size-full object-cover" />
        ) : currentKey ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 bg-linear-to-br from-akosi-accent/25 to-akosi-accent-2/25 text-akosi-muted-fg">
            <ImagePlusIcon className={size === "lg" ? "size-8" : "size-5"} strokeWidth={1.5} />
            {size === "lg" ? <span className="text-xs">Cover uploaded</span> : null}
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-akosi-muted-fg">
            <ImagePlusIcon className={size === "lg" ? "size-8" : "size-5"} strokeWidth={1.5} />
            {size === "lg" ? (
              <span className="px-4 text-center text-xs">Drop an image, or click to browse</span>
            ) : null}
          </div>
        )}

        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100",
            busy && "opacity-100",
          )}
        >
          {busy ? (
            <Loader2Icon className="size-6 animate-spin text-white" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-white">
              <CameraIcon className="size-5" />
              <span className="text-xs font-medium">{hasExisting ? "Replace" : "Upload"}</span>
            </div>
          )}
        </div>
      </button>
      {error ? <p className="mt-2 text-xs text-akosi-accent-2">{error}</p> : null}
    </div>
  );
}
