"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCardIcon,
  DiscIcon,
  Music2Icon,
  MusicIcon,
  PlayIcon,
  UsersIcon,
} from "lucide-react";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatTile } from "@/components/admin/stat-tile";
import { Badge } from "@/components/ui/badge";
import { NewArtistDialog } from "@/components/admin/catalog/new-artist-dialog";
import { NewReleaseDialog } from "@/components/admin/catalog/new-release-dialog";
import { cn } from "@/lib/utils";

function CardsStatusBar({ byStatus }: { byStatus: api.Stats["cardsByStatus"] }) {
  const total = byStatus.UNCLAIMED + byStatus.CLAIMED + byStatus.REVOKED;
  const segments = [
    { key: "UNCLAIMED", label: "Unclaimed", value: byStatus.UNCLAIMED, className: "bg-akosi-accent-2" },
    { key: "CLAIMED", label: "Claimed", value: byStatus.CLAIMED, className: "bg-akosi-accent" },
    { key: "REVOKED", label: "Revoked", value: byStatus.REVOKED, className: "bg-akosi-fg/25" },
  ] as const;

  return (
    <div className="rounded-xl border-2 border-akosi-fg/10 bg-akosi-surface p-5">
      <p className="font-display text-base font-medium">Cards by status</p>
      {total === 0 ? (
        <p className="mt-3 text-sm text-akosi-muted-fg">No cards provisioned yet.</p>
      ) : (
        <>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-akosi-bg">
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
                <span className="font-medium text-akosi-fg">{s.value}</span>
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

  return (
    <AdminShell>
      <div className="px-8 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b-2 border-akosi-fg/10 pb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Dashboard</h1>
            <p className="mt-1 text-sm text-akosi-muted-fg">An overview of your catalog.</p>
          </div>
          <div className="flex gap-2">
            {artists ? (
              <NewArtistDialog
                onCreated={(a) => {
                  setArtists([{ ...a, releaseCount: 0, trackCount: 0 }, ...artists]);
                  refreshStats();
                }}
              />
            ) : null}
            {artists ? <NewReleaseDialog artists={artists} onCreated={goToNewRelease} /> : null}
          </div>
        </div>

        {stats === null ? (
          <p className="text-sm text-akosi-muted-fg">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile icon={UsersIcon} label="Artists" value={stats.artistCount} accent="accent" />
            <StatTile icon={DiscIcon} label="Releases" value={stats.releaseCount} accent="accent-2" />
            <StatTile icon={Music2Icon} label="Tracks" value={stats.trackCount} accent="accent" />
            <StatTile icon={PlayIcon} label="Total plays" value={stats.totalPlays} accent="accent-2" />
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Recent releases</h2>
            </div>
            {releases === null ? (
              <p className="text-sm text-akosi-muted-fg">Loading…</p>
            ) : releases.length === 0 ? (
              <p className="text-sm text-akosi-muted-fg">No releases yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {releases.slice(0, 8).map((release) => (
                  <Link
                    key={release.id}
                    href={`/admin/releases/${release.id}`}
                    className="group rounded-xl border-2 border-akosi-fg/10 bg-akosi-surface p-3 transition-colors hover:border-akosi-accent-2/40"
                  >
                    <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-linear-to-br from-akosi-accent/20 to-akosi-accent-2/20">
                      {release.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={release.coverUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-akosi-muted-fg/60">
                          <MusicIcon className="size-8" strokeWidth={1.5} />
                        </div>
                      )}
                      <Badge className="absolute top-2 right-2 border-none bg-black/60 text-[10px] text-white backdrop-blur-sm">
                        {release.trackCount} track{release.trackCount === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <p className="truncate font-medium group-hover:text-akosi-accent-2">
                      {release.title}
                    </p>
                    <p className="truncate text-sm text-akosi-muted-fg">{release.artistName}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <CardsStatusBar byStatus={stats?.cardsByStatus ?? { UNCLAIMED: 0, CLAIMED: 0, REVOKED: 0 }} />

            <div className="rounded-xl border-2 border-akosi-fg/10 bg-akosi-surface p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-base font-medium">Artists</p>
                <Link
                  href="/admin/artists"
                  className="text-xs font-medium text-akosi-accent-2 hover:underline"
                >
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
                        className="flex items-center gap-2.5 hover:text-akosi-accent-2"
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
                        <span className="shrink-0 text-xs text-akosi-muted-fg">
                          {artist.trackCount} track{artist.trackCount === 1 ? "" : "s"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border-2 border-dashed border-akosi-accent-2/40 bg-akosi-accent-2/5 p-5">
              <div className="mb-2 flex items-center gap-2 text-akosi-accent-2">
                <CreditCardIcon className="size-4" />
                <p className="font-display text-sm font-medium">Manage cards</p>
              </div>
              <p className="text-sm text-akosi-muted-fg">
                Provision a card and assign it to a track to gate playback.
              </p>
              <Link
                href="/admin/cards"
                className="mt-3 inline-flex items-center text-sm font-medium text-akosi-accent-2 hover:underline"
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
