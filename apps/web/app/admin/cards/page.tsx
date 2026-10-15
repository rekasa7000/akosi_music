"use client";

import { useEffect, useState } from "react";
import { CreditCardIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { NewCardDialog } from "@/components/admin/catalog/new-card-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CardsPage() {
  const [cards, setCards] = useState<api.Card[] | null>(null);
  const [tracks, setTracks] = useState<api.TrackPickerEntry[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api.listCards().then(setCards);
    api.listAllTracks().then(setTracks);
  }, []);

  async function toggleRevoke(card: api.Card) {
    setBusyId(card.id);
    try {
      const updated = await api.updateCard(card.id, {
        status: card.status === "REVOKED" ? "UNCLAIMED" : "REVOKED",
      });
      setCards((prev) => prev?.map((c) => (c.id === card.id ? updated : c)) ?? null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl px-8 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Cards</h1>
            <p className="mt-1 text-sm text-akosi-muted-fg">
              Manually provisioned cards and the tracks they unlock.
            </p>
          </div>
          {tracks ? (
            <NewCardDialog
              tracks={tracks}
              onCreated={(c) => setCards((prev) => [c, ...(prev ?? [])])}
            />
          ) : null}
        </div>

        {cards === null ? (
          <p className="text-sm text-akosi-muted-fg">Loading…</p>
        ) : cards.length === 0 ? (
          <p className="text-sm text-akosi-muted-fg">
            No cards yet — provision one to gate a track.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-akosi-fg/10 bg-akosi-surface">
            {cards.map((card, i) => (
              <div
                key={card.id}
                className={cn(
                  "flex items-center gap-4 px-5 py-3.5",
                  i !== 0 && "border-t border-akosi-fg/10",
                )}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-akosi-accent/10 text-akosi-accent-2">
                  <CreditCardIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm font-medium">{card.uid}</p>
                  <p className="truncate text-xs text-akosi-muted-fg">
                    {card.trackTitle} — {card.releaseTitle} ({card.artistName})
                  </p>
                </div>
                {card.editionLabel ? (
                  <Badge variant="outline" className="shrink-0 border-akosi-fg/15 text-akosi-muted-fg">
                    {card.editionLabel}
                  </Badge>
                ) : null}
                <span className="shrink-0 text-sm tabular-nums text-akosi-muted-fg">
                  {card.playCount} play{card.playCount === 1 ? "" : "s"}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 border-akosi-fg/15",
                    card.status === "REVOKED"
                      ? "text-akosi-accent-2"
                      : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {card.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === card.id}
                  className="shrink-0 text-akosi-muted-fg hover:text-akosi-fg"
                  onClick={() => toggleRevoke(card)}
                >
                  {card.status === "REVOKED" ? "Restore" : "Revoke"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
