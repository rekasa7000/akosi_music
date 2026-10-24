"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, DiscIcon, MusicIcon } from "lucide-react";
import * as api from "@/lib/public-api";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { ThemeToggle } from "@/components/admin/theme-toggle";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function LinkPill({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-full border border-akosi-fg/15 px-4 py-1.5 text-sm font-medium transition-colors hover:border-akosi-accent-2/40 hover:text-akosi-accent-2"
    >
      {label}
    </a>
  );
}

export default function PublicArtistPage() {
  const params = useParams<{ slug: string }>();
  const [artist, setArtist] = useState<api.PublicArtistDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.getArtist(params.slug).then(setArtist).catch(() => setNotFound(true));
  }, [params.slug]);

  if (notFound) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-akosi-bg font-sans text-akosi-fg">
        <div className="text-center">
          <p className="text-sm text-akosi-muted-fg">This artist isn&apos;t published yet.</p>
          <Link href="/artists" className="mt-3 inline-block text-sm text-akosi-accent-2 hover:underline">
            Back to all artists
          </Link>
        </div>
      </div>
    );
  }

  if (!artist) return null;

  return (
    <div className="min-h-dvh bg-akosi-bg font-sans text-akosi-fg">
      <header className="flex items-center justify-between border-b-2 border-akosi-fg/15 px-6 py-5 lg:px-10">
        <Link href="/">
          <AkosiWordmark />
        </Link>
        <ThemeToggle />
      </header>

      <main>
        <div className="relative aspect-[3/1] w-full overflow-hidden bg-linear-to-br from-akosi-accent/25 to-akosi-accent-2/25">
          {artist.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artist.coverImageUrl} alt="" className="size-full object-cover" />
          ) : null}
          <Link
            href="/artists"
            className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:top-6 sm:left-6"
          >
            <ArrowLeftIcon className="size-3.5" />
            All artists
          </Link>
        </div>

        <div className="mx-auto max-w-5xl px-6 lg:px-10">
          <div className="mt-4 flex items-end gap-5">
            <div className="relative -mt-16 flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-akosi-accent to-akosi-accent-2 text-2xl font-semibold text-white ring-4 ring-akosi-bg">
              {artist.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artist.profileImageUrl} alt="" className="size-full object-cover" />
              ) : (
                initials(artist.name)
              )}
            </div>
            <h1 className="font-display pb-1 text-4xl font-semibold sm:text-5xl">{artist.name}</h1>
          </div>

          {artist.bio ? (
            <p className="mt-6 max-w-2xl text-lg text-akosi-muted-fg">{artist.bio}</p>
          ) : null}

          {artist.websiteUrl || artist.instagramUrl || artist.twitterUrl ? (
            <div className="mt-5 flex flex-wrap gap-2.5">
              <LinkPill href={artist.websiteUrl} label="Website" />
              <LinkPill href={artist.instagramUrl} label="Instagram" />
              <LinkPill href={artist.twitterUrl} label="Twitter / X" />
            </div>
          ) : null}

          <section className="mt-14 border-t-2 border-akosi-fg/10 pt-10 pb-24">
            <h2 className="font-display mb-6 text-xl font-semibold">Releases</h2>
            {artist.releases.length === 0 ? (
              <p className="text-sm text-akosi-muted-fg">Nothing published yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {artist.releases.map((release) => (
                  <Link
                    key={release.id}
                    href={`/r/${release.id}`}
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
                    </div>
                    <p className="truncate font-medium group-hover:text-akosi-accent-2">{release.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-akosi-muted-fg">
                      <DiscIcon className="size-3.5" />
                      {release.trackCount} track{release.trackCount === 1 ? "" : "s"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
