"use client";

import { useEffect, useState } from "react";
import { CheckCircle2Icon, CreditCardIcon, XCircleIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatTile } from "@/components/admin/stat-tile";
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

  const activeCount = cards?.filter((c) => c.status !== "REVOKED").length ?? 0;
  const revokedCount = cards?.filter((c) => c.status === "REVOKED").length ?? 0;

  return (
    <AdminShell>
      <div className="px-8 py-10">
        <div className="mb-8 flex items-center justify-between border-b-2 border-akosi-fg/10 pb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Cards</h1>
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

        {cards !== null ? (
          <div className="mb-8 grid grid-cols-3 gap-4">
            <StatTile icon={CreditCardIcon} label="Total cards" value={cards.length} accent="accent" />
            <StatTile icon={CheckCircle2Icon} label="Active" value={activeCount} accent="accent-2" />
            <StatTile icon={XCircleIcon} label="Revoked" value={revokedCount} accent="accent" />
          </div>
        ) : null}

        {cards === null ? (
          <p className="text-sm text-akosi-muted-fg">Loading…</p>
        ) : cards.length === 0 ? (
          <p className="text-sm text-akosi-muted-fg">
            No cards yet — provision one to gate a track.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {cards.map((card) => (
              <div
                key={card.id}
                className={cn(
                  "relative flex items-center gap-4 overflow-hidden rounded-xl border-2 bg-akosi-surface py-4 pr-5 pl-6",
                  card.status === "REVOKED" ? "border-akosi-fg/10" : "border-akosi-accent-2/30",
                )}
              >
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 w-1.5",
                    card.status === "REVOKED" ? "bg-akosi-fg/20" : "bg-akosi-accent-2",
                  )}
                />
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-akosi-accent/10 text-akosi-accent-2">
                  <CreditCardIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-base font-semibold">{card.uid}</p>
                  <p className="truncate text-sm text-akosi-muted-fg">
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
                  className={cn(
                    "shrink-0 border-none",
                    card.status === "REVOKED"
                      ? "bg-akosi-fg/10 text-akosi-muted-fg"
                      : "bg-akosi-accent-2/15 text-akosi-accent-2",
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
