"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicArtistInfo } from "@/lib/public-api";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { cn } from "@/lib/utils";

function SocialPill({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-sm font-medium text-akosi-accent-2 transition-colors hover:text-akosi-accent"
    >
      {label}
    </a>
  );
}

export function TapInfoPanel({
  artist,
  lyrics,
}: {
  artist: PublicArtistInfo;
  lyrics: string | null;
}) {
  const [tab, setTab] = useState<"artist" | "lyrics">("artist");

  return (
    <div className="px-5 py-6">
      <div className="inline-flex rounded-full border border-akosi-fg/15 bg-akosi-surface p-1">
        {(["artist", "lyrics"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-akosi-accent text-white" : "text-akosi-muted-fg hover:text-akosi-fg",
            )}
          >
            {t === "artist" ? "Artist" : "Lyrics"}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "artist" ? (
          <div>
            <p className="mb-4 text-sm font-semibold tracking-wide text-akosi-accent-2 uppercase">
              About the Artist
            </p>
            <div className="flex gap-4">
              <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-linear-to-br from-akosi-accent/30 to-akosi-accent-2/30">
                {artist.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={artist.profileImageUrl} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-akosi-muted-fg">ako si</p>
                <p className="truncate font-display text-xl font-bold text-akosi-accent-2">{artist.name}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <SocialPill href={artist.facebookUrl} label="Facebook" />
                  <SocialPill href={artist.instagramUrl} label="Instagram" />
                  <SocialPill href={artist.spotifyUrl} label="Spotify" />
                </div>
              </div>
            </div>
            {artist.bio ? (
              <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-akosi-muted-fg">{artist.bio}</p>
            ) : null}

            <div className="mt-8 rounded-xl bg-akosi-surface p-5">
              <AkosiWordmark />
              <p className="mt-3 text-sm font-semibold text-akosi-fg">About akosimusic.ph</p>
              <p className="mt-1.5 text-sm leading-relaxed text-akosi-muted-fg">
                akosimusic.ph is a physical music distribution company that invests on the rise of the
                creative industries in the market, merging with technology. It is a brand that circulates
                music through tangible collectible items that engage with its customers.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex items-center rounded-full bg-akosi-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-akosi-accent-2"
              >
                Learn More
              </Link>
            </div>
          </div>
        ) : (
          <div>
            {lyrics ? (
              <p className="text-base leading-relaxed whitespace-pre-wrap text-akosi-fg">{lyrics}</p>
            ) : (
              <p className="text-sm text-akosi-muted-fg">No lyrics added for this track yet.</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-xl border-2 border-akosi-fg/10 p-5">
        <p className="font-display text-lg font-bold text-akosi-fg">Your feedback matters to us!</p>
        <p className="mt-1 text-sm text-akosi-muted-fg">Report any issues or share us your thoughts.</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <a
            href="#"
            className="rounded-full border border-akosi-fg/20 px-4 py-2 text-sm font-medium text-akosi-fg transition-colors hover:border-akosi-accent-2/40 hover:text-akosi-accent-2"
          >
            Error Form
          </a>
          <a
            href="#"
            className="rounded-full border border-akosi-fg/20 px-4 py-2 text-sm font-medium text-akosi-fg transition-colors hover:border-akosi-accent-2/40 hover:text-akosi-accent-2"
          >
            Feedback Form
          </a>
        </div>
      </div>

      <div className="mt-6 pb-4">
        <p className="font-display text-lg font-bold text-akosi-fg">Connect with us!</p>
        <p className="mt-1 text-sm text-akosi-muted-fg">Keep in touch and stay updated.</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-akosi-muted-fg">
          <a href="#" className="hover:text-akosi-accent-2">
            Facebook
          </a>
          <a href="#" className="hover:text-akosi-accent-2">
            Instagram
          </a>
          <a href="mailto:akosimusic8@gmail.com" className="hover:text-akosi-accent-2">
            akosimusic8@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}
