"use client";

import { useState, type FormEvent } from "react";
import * as api from "@/lib/admin-api";
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

// No real checkout exists yet (see docs/02-product.md) — this is the
// manual stand-in: admin records who a physical card went to. Also
// covers reassigning an already-CLAIMED card to a different email;
// the backend upserts ownership either way, so this is the same call
// for both "mark as sold" and "reassign."
export function MarkCardSoldDialog({
  card,
  onUpdated,
}: {
  card: api.Card;
  onUpdated: (card: api.Card) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isReassign = card.status === "CLAIMED";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setError(null);
    setBusy(true);
    try {
      const updated = await api.markCardSold(card.id, email);
      onUpdated(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof api.AdminApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="shrink-0 text-akosi-muted-fg hover:text-akosi-fg">
          {isReassign ? "Reassign" : "Mark as sold"}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-akosi-surface text-akosi-fg">
        <DialogHeader>
          <DialogTitle className="font-display">{isReassign ? "Reassign owner" : "Mark as sold"}</DialogTitle>
          <DialogDescription>
            {isReassign
              ? `Currently recorded as ${card.ownerEmail}. Enter a new email to reassign ownership.`
              : "No real checkout yet — record who this physical card went to."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="sold-email">Customer email</Label>
            <Input id="sold-email" name="email" type="email" required autoFocus placeholder="fan@email.com" />
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
              {busy ? "Saving…" : isReassign ? "Reassign" : "Mark as sold"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
