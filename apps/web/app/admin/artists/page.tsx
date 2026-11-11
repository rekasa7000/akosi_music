"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DiscIcon, Music2Icon, SearchIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader } from "@/components/dash/page-header";
import { EmptyState } from "@/components/dash/empty-state";
import { StatusStamp } from "@/components/dash/status-stamp";
import { NewArtistDialog } from "@/components/admin/catalog/new-artist-dialog";
import { LifecycleMenu } from "@/components/admin/catalog/lifecycle-actions";
import { Input } from "@/components/ui/input";
import { FOIL_SWEEPS } from "@/lib/foil-sweeps";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function ArtistsPage() {
  const [artists, setArtists] = useState<api.ArtistWithCounts[] | null>(null);
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setArtists(null);
    api.listArtists({ archived }).then(setArtists);
  }, [archived]);

  function removeFromList(id: string) {
    setArtists((prev) => prev?.filter((a) => a.id !== id) ?? prev);
  }

  const filtered = useMemo(() => {
    if (!artists) return null;
    const q = query.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter(
      (a) => a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q),
    );
  }, [artists, query]);

  return (
    <AdminShell>
      <div className="px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader
          eyebrow="akosi admin"
          title="artists"
          word="roster"
          description="The roster — browse each artist's releases, tracks, and portal account."
          actions={
            !archived && artists ? (
              <NewArtistDialog
                onCreated={(a) => setArtists([{ ...a, releaseCount: 0, trackCount: 0 }, ...artists])}
              />
            ) : null
          }
        />

        {/* Filter bar — calm data-zone chrome, no decoration. */}
        <div className="mt-6 mb-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-akosi-muted-fg" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or slug…"
              aria-label="Search artists"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 text-sm">
            {([false, true] as const).map((isArchived) => (
              <button
                key={String(isArchived)}
                type="button"
                onClick={() => setArchived(isArchived)}
                className={cn(
                  "min-h-11 rounded-full px-4 py-1.5 font-medium transition-colors",
                  archived === isArchived
                    ? "bg-akosi-accent-2/15 text-akosi-accent-2"
                    : "text-akosi-muted-fg hover:text-akosi-fg",
                )}
              >
                {isArchived ? "Archived" : "Active"}
              </button>
            ))}
          </div>
        </div>

        {filtered === null ? (
          <p className="text-sm text-akosi-muted-fg">Loading…</p>
        ) : filtered.length === 0 ? (
          query ? (
            <p className="text-sm text-akosi-muted-fg">No artists match &quot;{query.trim()}&quot;.</p>
          ) : archived ? (
            <p className="text-sm text-akosi-muted-fg">No archived artists.</p>
          ) : (
            <EmptyState
              title="no artists on the roster yet"
              body="Every catalog starts with one name. Add an artist, then build their releases and cards from their page."
              sweep="plum"
              cta={
                <NewArtistDialog
                  onCreated={(a) =>
                    setArtists((prev) => [{ ...a, releaseCount: 0, trackCount: 0 }, ...(prev ?? [])])
                  }
                />
              }
            />
          )
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((artist, idx) => {
              const isNew =
                !artist.deletedAt && Date.now() - new Date(artist.createdAt).getTime() < WEEK_MS;
              return (
                <Link
                  key={artist.id}
                  href={`/admin/artists/${artist.id}`}
                  className={cn(
                    "group akosi-rise relative overflow-hidden rounded-2xl border-2 border-akosi-fg/15 bg-akosi-surface transition-all duration-300 hover:-translate-y-1 hover:border-akosi-accent-2/40 hover:shadow-[0_20px_40px_-24px] hover:shadow-akosi-accent/40 lg:hover:rotate-0",
                    idx % 2 === 0 ? "lg:-rotate-1" : "lg:rotate-1",
                    artist.deletedAt && "opacity-60",
                  )}
                  style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}
                >
                  <div
                    className="absolute top-2 right-2 z-10 rounded-full bg-akosi-surface/90"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <LifecycleMenu
                      deletedAt={artist.deletedAt}
                      itemLabel="artist"
                      size="sm"
                      getCascadeCounts={() => api.getArtistCascadeCounts(artist.id)}
                      onArchive={async () => {
                        await api.archiveArtist(artist.id);
                        removeFromList(artist.id);
                      }}
                      onRestore={async () => {
                        await api.restoreArtist(artist.id);
                        if (archived) removeFromList(artist.id);
                      }}
                      onDeletePermanently={async () => {
                        await api.deleteArtistPermanently(artist.id);
                        removeFromList(artist.id);
                      }}
                    />
                  </div>
                  {/* Foil sweep always underneath — a presigned cover URL
                      can 404, and a hidden broken img then falls back to
                      the sweep instead of the browser's broken-image glyph. */}
                  <div
                    className="relative h-24 overflow-hidden"
                    style={{ background: FOIL_SWEEPS[idx % FOIL_SWEEPS.length] }}
                  >
                    {artist.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={artist.coverImageUrl}
                        alt=""
                        className="size-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                    <div aria-hidden="true" className="akosi-foil-shine pointer-events-none absolute inset-0" />
                  </div>
                  <div className="relative px-5 pb-5">
                    <div className="-mt-8 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-akosi-accent to-akosi-accent-2 text-base font-medium text-white ring-4 ring-akosi-surface">
                      {artist.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={artist.profileImageUrl} alt="" className="size-full object-cover" />
                      ) : (
                        initials(artist.name)
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <p className="min-w-0 truncate font-display text-lg font-semibold group-hover:text-akosi-accent-2">
                        {artist.name}
                      </p>
                      {/* The screen's single highlight: a teal stamp on
                          roster additions from the last 7 days. */}
                      {isNew ? <StatusStamp tone="highlight">New</StatusStamp> : null}
                    </div>
                    <p className="truncate text-sm text-akosi-muted-fg">{artist.slug}</p>
                    <div className="mt-3 flex items-center gap-4 border-t border-dashed border-akosi-fg/15 pt-3 text-sm text-akosi-muted-fg">
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <Music2Icon className="size-3.5" />
                        {artist.trackCount} track{artist.trackCount === 1 ? "" : "s"}
                      </span>
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <DiscIcon className="size-3.5" />
                        {artist.releaseCount} release{artist.releaseCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
