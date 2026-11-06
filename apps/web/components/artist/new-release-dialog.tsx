"use client";

import { useState, type FormEvent } from "react";
import * as api from "@/lib/artist-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Simpler than the admin version — no artist picker, since the artist is
// implicit from the session (every artist-scoped route resolves it
// server-side from the cookie, never from anything the client sends).
export function NewReleaseDialog({ onCreated }: { onCreated: (release: api.Release) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = String(new FormData(e.currentTarget).get("title") ?? "").trim();
    setError(null);
    setBusy(true);
    try {
      const release = await api.createRelease({ title });
      onCreated(release);
      setOpen(false);
    } catch (err) {
      setError(err instanceof api.ArtistApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60">
          New release
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-akosi-surface text-akosi-fg">
        <DialogHeader>
          <DialogTitle className="font-display">New release</DialogTitle>
          <DialogDescription>Add tracks after creating it.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="release-title">Title</Label>
            <Input id="release-title" name="title" required autoFocus />
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
              {busy ? "Creating…" : "Create release"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
