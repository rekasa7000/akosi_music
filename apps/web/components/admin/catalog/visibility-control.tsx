"use client";

import { useState, type FormEvent } from "react";
import * as api from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="border-akosi-fg/15 text-akosi-muted-fg"
        >
          {release.visibility}
        </Badge>
        {release.visibility === "PRIVATE" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className="border-akosi-fg/15 bg-transparent! text-akosi-fg! hover:bg-akosi-fg/10!"
            onClick={makePublic}
          >
            Make public
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className="border-akosi-fg/15 bg-transparent! text-akosi-fg! hover:bg-akosi-fg/10!"
            onClick={() => setEditingPassword(true)}
          >
            Make private
          </Button>
        )}
        {release.visibility === "PRIVATE" && !editingPassword ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-akosi-muted-fg hover:text-akosi-fg"
            onClick={() => setEditingPassword(true)}
          >
            Change password
          </Button>
        ) : null}
      </div>

      {editingPassword ? (
        <form className="flex items-end gap-2" onSubmit={handlePasswordSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="release-password">Password</Label>
            <Input
              id="release-password"
              name="password"
              type="password"
              minLength={6}
              required
              autoFocus
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
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
