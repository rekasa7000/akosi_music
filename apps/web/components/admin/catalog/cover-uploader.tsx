"use client";

import { useRef, useState } from "react";
import * as api from "@/lib/admin-api";
import { Button } from "@/components/ui/button";

export function CoverUploader({
  currentKey,
  onUploaded,
}: {
  currentKey: string | null;
  onUploaded: (key: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
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

  return (
    <div className="flex items-center gap-3">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-akosi-fg/15 bg-akosi-bg text-xs text-akosi-muted-fg">
        {currentKey ? "Set" : "None"}
      </div>
      <div>
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          className="border-akosi-fg/15 bg-transparent! text-akosi-fg! hover:bg-akosi-fg/10!"
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : currentKey ? "Replace cover" : "Upload cover"}
        </Button>
        {error ? <p className="mt-1 text-xs text-akosi-accent-2">{error}</p> : null}
      </div>
    </div>
  );
}
