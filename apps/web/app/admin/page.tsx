"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCardIcon, DiscIcon, MusicIcon, PlayIcon, UsersIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader } from "@/components/dash/page-header";
import { ActivityMarquee } from "@/components/dash/activity-marquee";
import { HeroStatRow, HeroStatTile } from "@/components/dash/hero-stat-tile";
import { TrendChart } from "@/components/dash/trend-chart";
import { EmptyState } from "@/components/dash/empty-state";
import { Badge } from "@/components/ui/badge";
import { NewArtistDialog } from "@/components/admin/catalog/new-artist-dialog";
import { NewReleaseDialog } from "@/components/admin/catalog/new-release-dialog";
import { cn } from "@/lib/utils";
import { FOIL_SWEEPS } from "@/lib/foil-sweeps";

function CardsStatusBar({ byStatus }: { byStatus: api.Stats["cardsByStatus"] }) {
  const total = byStatus.UNCLAIMED + byStatus.CLAIMED + byStatus.REVOKED;
  const segments = [
    { key: "UNCLAIMED", label: "Unclaimed", value: byStatus.UNCLAIMED, className: "bg-akosi-accent-2" },
    { key: "CLAIMED", label: "Claimed", value: byStatus.CLAIMED, className: "bg-akosi-accent" },
    { key: "REVOKED", label: "Revoked", value: byStatus.REVOKED, className: "bg-akosi-fg/25" },
  ] as const;

  return (
    <div className="rounded-2xl border-2 border-akosi-fg/15 bg-akosi-surface p-5">
      <p className="font-display text-base font-medium">Cards by status</p>
      {total === 0 ? (
        <p className="mt-3 text-sm text-akosi-muted-fg">No cards provisioned yet.</p>
      ) : (
        <>
          <div className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-akosi-bg">
            {segments.map((s) =>
              s.value > 0 ? (
                <div key={s.key} className={s.className} style={{ width: `${(s.value / total) * 100}%` }} />
              ) : null,
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {segments.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-sm">
                <span className={cn("size-2.5 rounded-full", s.className)} />
                <span className="font-medium text-akosi-fg tabular-nums">{s.value}</span>
                <span className="text-akosi-muted-fg">{s.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<api.Stats | null>(null);
  const [artists, setArtists] = useState<api.ArtistWithCounts[] | null>(null);
  const [releases, setReleases] = useState<api.ReleaseSummary[] | null>(null);

  useEffect(() => {
    api.getStats().then(setStats);
    api.listArtists().then(setArtists);
    api.listReleases().then(setReleases);
  }, []);

  function refreshStats() {
    api.getStats().then(setStats);
  }

  // Straight to the release page after creation — that's where the
  // cover art and tracks actually get added, so there's no point
  // landing back on the dashboard first.
  function goToNewRelease(release: api.Release) {
    router.push(`/admin/releases/${release.id}`);
  }

  // Live-activity strip: real numbers only, skipping anything at zero —
  // an honest ticker, not invented hype.
  const tickerItems = stats
    ? [
        stats.playsToday > 0 ? `${stats.playsToday} plays today` : null,
        stats.totalPlays > 0 ? `${stats.totalPlays.toLocaleString()} plays all-time` : null,
        stats.cardsByStatus.CLAIMED > 0 ? `${stats.cardsByStatus.CLAIMED} cards claimed` : null,
        stats.cardsByStatus.UNCLAIMED > 0 ? `${stats.cardsByStatus.UNCLAIMED} cards awaiting owners` : null,
        stats.artistCount > 0 ? `${stats.artistCount} artists on the roster` : null,
        releases?.[0] ? `latest release: ${releases[0].title}` : null,
      ].filter((item): item is string => item !== null)
    : [];

  return (
    <AdminShell>
      <div className="px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader
          eyebrow="akosi admin"
          title="overview"
          description="Run the platform — roster, catalog, cards."
          actions={
            artists ? (
              <>
                <NewArtistDialog
                  onCreated={(a) => {
                    setArtists([{ ...a, releaseCount: 0, trackCount: 0 }, ...artists]);
                    refreshStats();
                  }}
                />
                <NewReleaseDialog artists={artists} onCreated={goToNewRelease} />
              </>
            ) : null
          }
        />

        {tickerItems.length > 0 ? (
          <div className="mt-4">
            <ActivityMarquee items={tickerItems} />
          </div>
        ) : null}

        {stats === null ? (
          <p className="mt-8 text-sm text-akosi-muted-fg">Loading…</p>
        ) : (
          <div className="mt-6">
            <HeroStatRow>
              {/* The screen's single highlight: today's play count,
                  stamped on the plays tile. */}
              <HeroStatTile
                label="Total plays"
                value={stats.totalPlays}
                icon={PlayIcon}
                sweep="ember"
                tilt={-2}
                highlight
                highlightNote={`${stats.playsToday.toLocaleString()} today`}
              />
              <HeroStatTile label="Artists" value={stats.artistCount} icon={UsersIcon} sweep="plum" delay={60} />
              <HeroStatTile
                label="Cards claimed"
                value={stats.cardsByStatus.CLAIMED}
                icon={CreditCardIcon}
                sweep="flare"
                tilt={1}
                delay={120}
              />
              <HeroStatTile label="Releases" value={stats.releaseCount} icon={DiscIcon} sweep="plum" delay={180} />
            </HeroStatRow>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
          <section className="min-w-0 space-y-6">
            {stats ? <TrendChart data={stats.playsByDay} title="Plays · last 14 days" /> : null}

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Recent releases</h2>
              </div>
              {releases === null ? (
                <p className="text-sm text-akosi-muted-fg">Loading…</p>
              ) : releases.length === 0 ? (
                <EmptyState
                  title="no releases yet"
                  body="The catalog starts with one release. Create it, add tracks, then provision cards against them."
                  cta={artists ? <NewReleaseDialog artists={artists} onCreated={goToNewRelease} /> : undefined}
                />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                  {releases.slice(0, 8).map((release, idx) => (
                    <Link
                      key={release.id}
                      href={`/admin/releases/${release.id}`}
                      className={cn(
                        "group akosi-rise rounded-2xl border-2 border-akosi-fg/15 bg-akosi-surface p-3 transition-all duration-300 hover:-translate-y-1 hover:border-akosi-accent-2/40 hover:shadow-[0_20px_40px_-24px] hover:shadow-akosi-accent/40 lg:hover:rotate-0",
                        idx % 2 === 0 ? "lg:-rotate-1" : "lg:rotate-1",
                      )}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div
                        className="relative mb-3 aspect-square overflow-hidden rounded-xl"
                        style={!release.coverUrl ? { background: FOIL_SWEEPS[idx % FOIL_SWEEPS.length] } : undefined}
                      >
                        {release.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={release.coverUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-white/80">
                            <MusicIcon className="size-8" strokeWidth={1.5} />
                          </div>
                        )}
                        <div
                          aria-hidden="true"
                          className="akosi-foil-shine pointer-events-none absolute inset-0"
                        />
                        <Badge className="absolute top-2 right-2 border-none bg-black/60 text-[10px] text-white backdrop-blur-sm">
                          {release.trackCount} track{release.trackCount === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <p className="truncate font-medium group-hover:text-akosi-accent-2">{release.title}</p>
                      <p className="truncate text-sm text-akosi-muted-fg">{release.artistName}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <CardsStatusBar byStatus={stats?.cardsByStatus ?? { UNCLAIMED: 0, CLAIMED: 0, REVOKED: 0 }} />

            <div className="rounded-2xl border-2 border-akosi-fg/15 bg-akosi-surface p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-base font-medium">Artists</p>
                <Link href="/admin/artists" className="text-xs font-medium text-akosi-accent-2 hover:underline">
                  View all
                </Link>
              </div>
              {artists === null ? (
                <p className="text-sm text-akosi-muted-fg">Loading…</p>
              ) : artists.length === 0 ? (
                <p className="text-sm text-akosi-muted-fg">No artists yet.</p>
              ) : (
                <ul className="space-y-3">
                  {artists.slice(0, 5).map((artist) => (
                    <li key={artist.id}>
                      <Link
                        href={`/admin/artists/${artist.id}`}
                        className="flex min-h-11 items-center gap-2.5 hover:text-akosi-accent-2"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-akosi-accent to-akosi-accent-2 text-xs font-medium text-white">
                          {artist.profileImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={artist.profileImageUrl} alt="" className="size-full object-cover" />
                          ) : (
                            artist.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{artist.name}</span>
                        <span className="shrink-0 text-xs text-akosi-muted-fg tabular-nums">
                          {artist.trackCount} track{artist.trackCount === 1 ? "" : "s"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border-2 border-dashed border-akosi-accent-2/40 bg-akosi-accent-2/5 p-5">
              <div className="mb-2 flex items-center gap-2 text-akosi-accent-2">
                <CreditCardIcon className="size-4" />
                <p className="font-display text-sm font-medium">Manage cards</p>
              </div>
              <p className="text-sm text-akosi-muted-fg">
                Provision a card and assign it to a track to gate playback.
              </p>
              <Link
                href="/admin/cards"
                className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-akosi-accent-2 hover:underline"
              >
                Go to Cards
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}
