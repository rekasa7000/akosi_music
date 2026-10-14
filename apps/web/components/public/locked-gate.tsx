"use client";

import { useState, type FormEvent } from "react";
import { LockIcon } from "lucide-react";
import * as api from "@/lib/public-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LockedGate({
  release,
  onUnlocked,
}: {
  release: api.PublicRelease;
  onUnlocked: (release: api.PublicRelease) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onUnlocked(await api.unlockRelease(release.id, password));
    } catch (err) {
      setError(err instanceof api.PublicApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="relative size-40 shrink-0 overflow-hidden rounded-lg shadow-lg sm:size-48">
        {release.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={release.coverUrl}
            alt=""
            className="size-full scale-110 object-cover blur-md"
          />
        ) : (
          <div className="size-full bg-linear-to-br from-akosi-accent/30 to-akosi-accent-2/30" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <LockIcon className="size-8 text-white" strokeWidth={1.5} />
        </div>
      </div>

      <div>
        <p className="text-sm text-akosi-muted-fg">{release.artistName}</p>
        <h1 className="font-display text-2xl font-semibold text-akosi-fg sm:text-3xl">
          {release.title}
        </h1>
        <p className="mt-2 text-sm text-akosi-muted-fg">This release is password-protected.</p>
      </div>

      <form className="w-full max-w-xs space-y-3" onSubmit={handleSubmit}>
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {error ? (
          <p role="alert" className="text-sm text-akosi-accent-2">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={busy}
          className="w-full bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60"
        >
          {busy ? "Unlocking…" : "Unlock"}
        </Button>
      </form>
    </div>
  );
}
