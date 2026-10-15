"use client";

import { useState, type FormEvent } from "react";
import * as api from "@/lib/public-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TrackCodeForm({
  onUnlocked,
}: {
  onUnlocked: (track: api.RedeemedTrack) => void;
}) {
  const [uid, setUid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onUnlocked(await api.redeemCard(uid));
    } catch (err) {
      setError(err instanceof api.PublicApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex items-center gap-2" onSubmit={handleSubmit}>
      <Input
        value={uid}
        onChange={(e) => setUid(e.target.value)}
        placeholder="Card code"
        autoFocus
        required
        className="h-8 w-36 font-mono text-sm"
      />
      <Button
        type="submit"
        size="sm"
        disabled={busy}
        className="bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60"
      >
        {busy ? "Checking…" : "Unlock"}
      </Button>
      {error ? <span className="text-xs text-akosi-accent-2">{error}</span> : null}
    </form>
  );
}
