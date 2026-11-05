"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DiscIcon, Music2Icon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { StageLight } from "@/components/admin/stage-light";
import { NewArtistDialog } from "@/components/admin/catalog/new-artist-dialog";
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

export default function ArtistsPage() {
  const [artists, setArtists] = useState<api.ArtistWithCounts[] | null>(null);

  useEffect(() => {
    api.listArtists().then(setArtists);
  }, []);

  return (
    <AdminShell>
      <div className="px-8 py-10">
        {/* The one ambient moment on this page — same confined stage-light
            glow as the dashboard's hero, not repeated per card. */}
        <div className="relative mb-8 overflow-hidden rounded-3xl border-2 border-akosi-fg/15">
          <StageLight />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -bottom-14 font-display text-[9rem] leading-none font-bold text-akosi-fg/5 select-none"
          >
            A
          </span>
          <div className="relative flex flex-wrap items-center justify-between gap-4 px-8 py-10">
            <div>
              <p className="font-display text-xs font-semibold tracking-[0.2em] text-akosi-accent-2 uppercase">
                akosi admin
              </p>
              <h1 className="mt-1 font-display text-4xl font-bold lowercase leading-[0.95]">Artists</h1>
              <p className="mt-2 text-sm text-akosi-muted-fg">
                Browse each artist&apos;s releases and tracks.
              </p>
            </div>
            {artists ? (
              <NewArtistDialog
                onCreated={(a) => setArtists([{ ...a, releaseCount: 0, trackCount: 0 }, ...artists])}
              />
            ) : null}
          </div>
        </div>

        {artists === null ? (
          <p className="text-sm text-akosi-muted-fg">Loading…</p>
        ) : artists.length === 0 ? (
          <p className="text-sm text-akosi-muted-fg">No artists yet — add one to get started.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {artists.map((artist, idx) => (
              <Link
                key={artist.id}
                href={`/admin/artists/${artist.id}`}
                className={cn(
                  "group overflow-hidden rounded-2xl border-2 border-akosi-fg/15 bg-akosi-surface transition-all duration-300 hover:-translate-y-1 hover:rotate-0 hover:border-akosi-accent-2/40 hover:shadow-[0_20px_40px_-24px] hover:shadow-akosi-accent/40",
                  idx % 2 === 0 ? "-rotate-1" : "rotate-1",
                )}
              >
                <div
                  className="relative h-24"
                  style={!artist.coverImageUrl ? { background: FOIL_SWEEPS[idx % FOIL_SWEEPS.length] } : undefined}
                >
                  {artist.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={artist.coverImageUrl} alt="" className="size-full object-cover" />
                  ) : null}
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
                  <p className="mt-3 truncate font-display text-lg font-semibold group-hover:text-akosi-accent-2">
                    {artist.name}
                  </p>
                  <p className="truncate text-sm text-akosi-muted-fg">{artist.slug}</p>
                  <div className="mt-3 flex items-center gap-4 border-t border-dashed border-akosi-fg/15 pt-3 text-sm text-akosi-muted-fg">
                    <span className="flex items-center gap-1.5">
                      <Music2Icon className="size-3.5" />
                      {artist.trackCount} track{artist.trackCount === 1 ? "" : "s"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <DiscIcon className="size-3.5" />
                      {artist.releaseCount} release{artist.releaseCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
