"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  const [artists, setArtists] = useState<api.Artist[] | null>(null);

  useEffect(() => {
    api.listArtists().then(setArtists);
  }, []);

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl px-8 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Artists</h1>
            <p className="mt-1 text-sm text-akosi-muted-fg">
              Browse each artist&apos;s releases and tracks.
            </p>
          </div>
          {artists ? <NewArtistDialog onCreated={(a) => setArtists([a, ...artists])} /> : null}
        </div>

        {artists === null ? (
          <p className="text-sm text-akosi-muted-fg">Loading…</p>
        ) : artists.length === 0 ? (
          <p className="text-sm text-akosi-muted-fg">No artists yet — add one to get started.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((artist) => (
              <Link
                key={artist.id}
                href={`/admin/artists/${artist.id}`}
                className="flex items-center gap-3 rounded-xl border border-akosi-fg/10 bg-akosi-surface p-4 transition-colors hover:bg-akosi-fg/5"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-akosi-accent to-akosi-accent-2 text-sm font-medium text-white">
                  {initials(artist.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{artist.name}</p>
                  <p className="truncate text-sm text-akosi-muted-fg">{artist.slug}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
