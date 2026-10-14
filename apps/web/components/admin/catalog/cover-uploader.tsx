"use client";

import { useRef, useState, type DragEvent } from "react";
import { CameraIcon, ImagePlusIcon, Loader2Icon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { cn } from "@/lib/utils";

export function CoverUploader({
  currentKey,
  onUploaded,
  size = "lg",
}: {
  currentKey: string | null;
  onUploaded: (key: string) => Promise<void>;
  size?: "lg" | "sm";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);

    setError(null);
    setBusy(true);
    try {
      const key = await api.uploadMedia("release-cover", file);
      await onUploaded(key);
    } catch (err) {
      setError(err instanceof api.AdminApiError ? err.message : "Upload failed.");
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

  const hasImage = Boolean(previewUrl);

  return (
    <div className={size === "lg" ? "w-full max-w-64" : "w-full max-w-36"}>
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
          "group relative aspect-square w-full overflow-hidden rounded-lg border transition-colors",
          dragging
            ? "border-akosi-accent-2 bg-akosi-accent-2/10"
            : "border-dashed border-akosi-fg/20 bg-akosi-surface hover:border-akosi-fg/35",
          hasImage && "border-solid border-akosi-fg/10",
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="size-full object-cover" />
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
              <span className="text-xs font-medium">{hasImage || currentKey ? "Replace" : "Upload"}</span>
            </div>
          )}
        </div>
      </button>
      {error ? <p className="mt-2 text-xs text-akosi-accent-2">{error}</p> : null}
    </div>
  );
}
