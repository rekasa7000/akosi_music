"use client";

import { useEffect, useMemo, useState } from "react";
import { NfcIcon } from "lucide-react";
import * as api from "@/lib/artist-api";
import { ArtistShell } from "@/components/artist/artist-shell";
import { PageHeader } from "@/components/dash/page-header";
import { EmptyState } from "@/components/dash/empty-state";
import { StatusStamp, CARD_STATUS_TONE } from "@/components/dash/status-stamp";
import { FOIL_SWEEPS } from "@/lib/foil-sweeps";
import { cn } from "@/lib/utils";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function provisionedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// A provisioned card rendered as the physical object it stands for:
// foil sweep, ticket-stub notches, stamped status. The printed serial
// is derived from the card's internal id — the uid (unlock code)
// never reaches this page.
function FoilCardTile({ card, idx }: { card: api.ArtistCard; idx: number }) {
  const isNew = Date.now() - new Date(card.provisionedAt).getTime() < WEEK_MS;
  const revoked = card.status === "REVOKED";

  return (
    <li
      className={cn(
        "group akosi-rise relative transition-transform duration-300 lg:hover:rotate-0",
        idx % 3 === 0 ? "lg:-rotate-1" : idx % 3 === 2 ? "lg:rotate-1" : "",
        revoked && "opacity-60",
      )}
      style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}
    >
      <div
        className="akosi-ticket relative aspect-[8/5] overflow-hidden rounded-[1.25rem] p-4 text-[#fff4e4]"
        style={{ background: FOIL_SWEEPS[idx % FOIL_SWEEPS.length] }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-black/50 via-black/20 to-transparent"
        />
        <div aria-hidden="true" className="akosi-foil-shine pointer-events-none absolute inset-0" />
        <NfcIcon aria-hidden="true" className="absolute top-4 right-4 size-6 text-white/70" strokeWidth={1.75} />
        <div className="relative flex h-full flex-col justify-between">
          <div className="min-w-0 pr-8">
            <p className="truncate font-display text-lg leading-tight font-bold">{card.trackTitle}</p>
            <p className="truncate text-sm opacity-80">{card.releaseTitle}</p>
          </div>
          <div className="flex items-end justify-between gap-2">
            <p className="font-mono text-sm tracking-widest opacity-90">Nº {card.serial}</p>
            <span className="font-display text-xs opacity-80">akosi ♪</span>
          </div>
        </div>
      </div>
      {/* Stamps sit on the frame, not inside the data line. */}
      <div className="absolute -top-2 left-3 flex gap-1.5">
        <StatusStamp tone={CARD_STATUS_TONE[card.status] ?? "muted"}>{card.status}</StatusStamp>
        {/* The screen's single highlight: freshly provisioned cards. */}
        {isNew && !revoked ? <StatusStamp tone="highlight">New</StatusStamp> : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-akosi-muted-fg">
          {card.editionLabel ?? "Standard edition"} · {provisionedLabel(card.provisionedAt)}
        </span>
        <span className="shrink-0 font-medium tabular-nums">
          {card.playCount} play{card.playCount === 1 ? "" : "s"}
        </span>
      </div>
    </li>
  );
}

export default function ArtistCardsPage() {
  const [cards, setCards] = useState<api.ArtistCard[] | null>(null);

  useEffect(() => {
    api.listCards().then(setCards);
  }, []);

  const grouped = useMemo(() => {
    if (!cards) return null;
    const map = new Map<string, api.ArtistCard[]>();
    for (const card of cards) {
      const key = `${card.releaseTitle} — ${card.trackTitle}`;
      map.set(key, [...(map.get(key) ?? []), card]);
    }
    return [...map.entries()];
  }, [cards]);

  return (
    <ArtistShell>
      <div className="px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader
          eyebrow="akosi artist portal"
          title="my cards"
          word="drops"
          description="Every physical card out there with your music on it, edition by edition."
        />

        <div className="mt-6">
          {grouped === null ? (
            <p className="text-sm text-akosi-muted-fg">Loading…</p>
          ) : grouped.length === 0 ? (
            <EmptyState
              title="no cards in the world yet"
              body="Cards are hand-provisioned by the akosi team, release by release. Get your tracks uploaded and ready — that's what a card unlocks."
              sweep="ember"
            />
          ) : (
            <div className="space-y-10">
              {grouped.map(([label, groupCards]) => (
                <section key={label}>
                  <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-lg font-semibold">{label}</h2>
                    <p className="text-sm text-akosi-muted-fg tabular-nums">
                      {groupCards.filter((c) => c.status !== "REVOKED").length}/{groupCards.length} active
                    </p>
                  </div>
                  <ul className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {groupCards.map((card, idx) => (
                      <FoilCardTile key={card.id} card={card} idx={idx} />
                    ))}
                  </ul>
                </section>
              ))}

              {/* Honest next-drop panel — provisioning stays with the
                  platform team for now; no self-serve flow is implied. */}
              <div className="rounded-2xl border-2 border-dashed border-akosi-accent-2/40 bg-akosi-accent-2/5 p-5">
                <p className="font-display text-sm font-medium text-akosi-accent-2">Planning a new drop?</p>
                <p className="mt-1 max-w-prose text-sm text-akosi-muted-fg">
                  New editions are provisioned by the akosi team against a track you&apos;ve uploaded. Get the
                  release ready here, then reach out and we&apos;ll press the cards.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </ArtistShell>
  );
}
