"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Music2Icon } from "lucide-react";
import * as api from "@/lib/public-api";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ArtistsDirectoryPage() {
  const [artists, setArtists] = useState<api.PublicArtistSummary[] | null>(null);

  useEffect(() => {
    api.listArtists().then(setArtists);
  }, []);

  return (
    <div className="min-h-dvh bg-akosi-bg font-sans text-akosi-fg">
      <header className="flex items-center justify-between border-b-2 border-akosi-fg/15 px-6 py-5 lg:px-10">
        <Link href="/">
          <AkosiWordmark />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-16 pb-24 lg:px-10">
        <h1 className="font-display leading-[0.95] font-semibold tracking-tight">
          <span className="block text-5xl sm:text-6xl">Every card</span>
          <span className="mt-1 block text-5xl text-akosi-accent-2 sm:text-6xl">
            starts with an artist.
          </span>
        </h1>
        <p className="mt-6 max-w-md text-lg text-akosi-muted-fg">
          Browse who we&apos;ve pressed cards for so far.
        </p>

        {artists === null ? (
          <p className="mt-16 text-sm text-akosi-muted-fg">Loading…</p>
        ) : artists.length === 0 ? (
          <p className="mt-16 text-sm text-akosi-muted-fg">No artists published yet — check back soon.</p>
        ) : (
          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((artist, i) => (
              <Link
                key={artist.slug}
                href={`/artists/${artist.slug}`}
                className="group relative overflow-hidden rounded-2xl border-2 border-akosi-fg/10 bg-akosi-surface transition-colors hover:border-akosi-accent-2/40"
                style={{ transform: i % 3 === 1 ? "rotate(-0.6deg)" : i % 3 === 2 ? "rotate(0.6deg)" : undefined }}
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-linear-to-br from-akosi-accent/25 to-akosi-accent-2/25">
                  {artist.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={artist.coverImageUrl}
                      alt=""
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="relative px-5 pt-0 pb-5">
                  <div className="-mt-9 flex size-18 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-akosi-accent to-akosi-accent-2 text-xl font-semibold text-white ring-4 ring-akosi-surface">
                    {artist.profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={artist.profileImageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      initials(artist.name)
                    )}
                  </div>
                  <p className="mt-3 font-display text-xl font-semibold group-hover:text-akosi-accent-2">
                    {artist.name}
                  </p>
                  {artist.bio ? (
                    <p className="mt-1.5 line-clamp-2 text-sm text-akosi-muted-fg">{artist.bio}</p>
                  ) : null}
                  <div className={cn("mt-3 flex items-center gap-1.5 text-sm text-akosi-muted-fg")}>
                    <Music2Icon className="size-3.5" />
                    {artist.releaseCount} release{artist.releaseCount === 1 ? "" : "s"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t-2 border-dashed border-akosi-fg/20 px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <AkosiWordmark className="opacity-70" />
          <p className="text-xs text-akosi-muted-fg">© {new Date().getFullYear()} akosi.music</p>
        </div>
      </footer>
    </div>
  );
}
