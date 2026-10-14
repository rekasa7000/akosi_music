"use client";

import { useState, type FormEvent } from "react";
import { GlobeIcon, LockIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function VisibilityControl({
  release,
  onUpdated,
}: {
  release: api.Release;
  onUpdated: (release: api.Release) => void;
}) {
  const [editingPassword, setEditingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function makePublic() {
    setError(null);
    setBusy(true);
    try {
      onUpdated(await api.updateRelease(release.id, { visibility: "PUBLIC" }));
    } catch (err) {
      setError(err instanceof api.AdminApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    setError(null);
    setBusy(true);
    try {
      const updated = await api.updateRelease(release.id, { visibility: "PRIVATE", password });
      onUpdated(updated);
      setEditingPassword(false);
    } catch (err) {
      setError(err instanceof api.AdminApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-full border border-akosi-fg/10 bg-akosi-surface p-1">
        <button
          type="button"
          disabled={busy}
          onClick={release.visibility === "PRIVATE" ? makePublic : undefined}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
            release.visibility === "PUBLIC"
              ? "bg-akosi-accent text-white"
              : "text-akosi-muted-fg hover:text-akosi-fg",
          )}
        >
          <GlobeIcon className="size-3.5" />
          Public
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={release.visibility === "PUBLIC" ? () => setEditingPassword(true) : undefined}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
            release.visibility === "PRIVATE"
              ? "bg-akosi-accent text-white"
              : "text-akosi-muted-fg hover:text-akosi-fg",
          )}
        >
          <LockIcon className="size-3.5" />
          Private
        </button>
      </div>

      {release.visibility === "PRIVATE" && !editingPassword ? (
        <button
          type="button"
          className="block text-xs text-akosi-muted-fg underline-offset-4 hover:text-akosi-fg hover:underline"
          onClick={() => setEditingPassword(true)}
        >
          Change password
        </button>
      ) : null}

      {editingPassword ? (
        <form
          className="flex items-end gap-2 rounded-md border border-akosi-fg/10 bg-akosi-surface p-3"
          onSubmit={handlePasswordSubmit}
        >
          <div className="space-y-1">
            <label htmlFor="release-password" className="text-xs text-akosi-muted-fg">
              Set a password for this release
            </label>
            <Input
              id="release-password"
              name="password"
              type="password"
              minLength={6}
              required
              autoFocus
              className="h-8"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={busy}
            className="bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-akosi-muted-fg hover:text-akosi-fg"
            onClick={() => setEditingPassword(false)}
          >
            Cancel
          </Button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-akosi-accent-2">
          {error}
        </p>
      ) : null}
    </div>
  );
}
