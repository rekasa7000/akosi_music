"use client";

import { useEffect, useState } from "react";
import { HeartIcon, WalletCardsIcon } from "lucide-react";
import * as api from "@/lib/artist-api";
import { ArtistShell } from "@/components/artist/artist-shell";
import { PageHeader } from "@/components/dash/page-header";
import { EmptyState } from "@/components/dash/empty-state";
import { StatusStamp } from "@/components/dash/status-stamp";
import { TrendChart } from "@/components/dash/trend-chart";
import { HeroStatRow, HeroStatTile } from "@/components/dash/hero-stat-tile";

function claimedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ArtistFansPage() {
  const [fans, setFans] = useState<api.Fan[] | null>(null);
  const [stats, setStats] = useState<api.ArtistStats | null>(null);

  useEffect(() => {
    api.listFans().then(setFans);
    api.getStats().then(setStats);
  }, []);

  return (
    <ArtistShell>
      <div className="px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader
          eyebrow="akosi artist portal"
          title="fans"
          word="the crowd"
          description="The people holding your cards. Emails are masked — you see your crowd, not their inboxes."
        />

        {stats ? (
          <div className="mt-6">
            <HeroStatRow cols={3}>
              <HeroStatTile label="Card owners" value={stats.ownerCount} icon={HeartIcon} sweep="plum" tilt={-1} />
              <HeroStatTile
                label="Cards claimed"
                value={stats.cardsByStatus.CLAIMED}
                icon={WalletCardsIcon}
                sweep="ember"
                delay={60}
              />
              <HeroStatTile
                label="Awaiting owners"
                value={stats.cardsByStatus.UNCLAIMED}
                icon={WalletCardsIcon}
                sweep="flare"
                tilt={1}
                delay={120}
              />
            </HeroStatRow>
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_24rem]">
          <section className="min-w-0">
            {fans === null ? (
              <p className="text-sm text-akosi-muted-fg">Loading…</p>
            ) : fans.length === 0 ? (
              <EmptyState
                title="your crowd starts here"
                body="No claimed cards yet. Once a card is sold and claimed, its owner shows up in this list — plays, editions, and all."
                sweep="plum"
              />
            ) : (
              <>
                {/* Semantic table from sm up — calm data zone. */}
                <div className="hidden overflow-hidden rounded-2xl border-2 border-akosi-fg/15 bg-akosi-surface sm:block">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Card owners ranked by plays</caption>
                    <thead>
                      <tr className="border-b-2 border-akosi-fg/10 text-xs tracking-wide text-akosi-muted-fg uppercase">
                        <th scope="col" className="px-5 py-3.5 font-semibold">Fan</th>
                        <th scope="col" className="px-5 py-3.5 text-right font-semibold">Cards</th>
                        <th scope="col" className="px-5 py-3.5 text-right font-semibold">Plays</th>
                        <th scope="col" className="px-5 py-3.5 text-right font-semibold">First claimed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fans.map((fan, idx) => (
                        <tr key={fan.ownerLabel + idx} className="border-b border-akosi-fg/10 last:border-b-0">
                          <th scope="row" className="px-5 py-3.5 font-medium">
                            <span className="flex items-center gap-2">
                              {fan.ownerLabel}
                              {/* The screen's single highlight: the one
                                  top fan by plays. */}
                              {idx === 0 && fan.totalPlays > 0 ? (
                                <StatusStamp tone="highlight" rotate={false}>
                                  Top fan
                                </StatusStamp>
                              ) : null}
                            </span>
                          </th>
                          <td className="px-5 py-3.5 text-right tabular-nums">{fan.cardsOwned}</td>
                          <td className="px-5 py-3.5 text-right tabular-nums">{fan.totalPlays.toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-right text-akosi-muted-fg tabular-nums">
                            {claimedLabel(fan.firstClaimedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Stacked cards below sm — the 3 key fields per fan. */}
                <ul className="space-y-3 sm:hidden">
                  {fans.map((fan, idx) => (
                    <li
                      key={fan.ownerLabel + idx}
                      className="rounded-2xl border-2 border-akosi-fg/15 bg-akosi-surface p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate font-medium">{fan.ownerLabel}</p>
                        {idx === 0 && fan.totalPlays > 0 ? (
                          <StatusStamp tone="highlight" rotate={false}>
                            Top fan
                          </StatusStamp>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-akosi-muted-fg">
                        <span className="tabular-nums">
                          {fan.cardsOwned} card{fan.cardsOwned === 1 ? "" : "s"}
                        </span>
                        <span className="tabular-nums">{fan.totalPlays.toLocaleString()} plays</span>
                        <span className="tabular-nums">since {claimedLabel(fan.firstClaimedAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <aside className="space-y-6">
            {stats ? <TrendChart data={stats.playsByDay} title="Plays · last 14 days" /> : null}
            <div className="rounded-2xl border-2 border-dashed border-akosi-fg/20 bg-akosi-surface p-5">
              <p className="font-display text-sm font-medium">Where in the world?</p>
              <p className="mt-1 text-sm text-akosi-muted-fg">
                Plays are anonymous right now, so there&apos;s no geography to show — maps arrive when fan
                accounts do.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </ArtistShell>
  );
}
