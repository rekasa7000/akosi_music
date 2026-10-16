"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Music2Icon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { NewArtistDialog } from "@/components/admin/catalog/new-artist-dialog";

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
      <div className="mx-auto max-w-6xl px-8 py-12">
        <div className="mb-8 flex items-center justify-between border-b-2 border-akosi-fg/10 pb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Artists</h1>
            <p className="mt-1 text-sm text-akosi-muted-fg">
              Browse each artist&apos;s releases and tracks.
            </p>
          </div>
          {artists ? (
            <NewArtistDialog
              onCreated={(a) => setArtists([{ ...a, releaseCount: 0, trackCount: 0 }, ...artists])}
            />
          ) : null}
        </div>

        {artists === null ? (
          <p className="text-sm text-akosi-muted-fg">Loading…</p>
        ) : artists.length === 0 ? (
          <p className="text-sm text-akosi-muted-fg">No artists yet — add one to get started.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((artist) => (
              <Link
                key={artist.id}
                href={`/admin/artists/${artist.id}`}
                className="group overflow-hidden rounded-xl border-2 border-akosi-fg/10 bg-akosi-surface transition-colors hover:border-akosi-accent-2/40"
              >
                <div className="relative h-24 bg-linear-to-br from-akosi-accent/25 to-akosi-accent-2/25">
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
                  <div className="mt-3 flex items-center gap-4 text-sm text-akosi-muted-fg">
                    <span className="flex items-center gap-1.5">
                      <Music2Icon className="size-3.5" />
                      {artist.trackCount} track{artist.trackCount === 1 ? "" : "s"}
                    </span>
                    <span>
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
