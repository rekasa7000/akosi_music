"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangleIcon, ChevronDownIcon, MusicIcon, VideoIcon } from "lucide-react";
import * as api from "@/lib/public-api";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Player } from "@/components/public/player";
import { cn } from "@/lib/utils";

// The tap-landing route: this page's only job is forwarding the
// card's code to the API and rendering what comes back, never
// constructing a storage URL itself (docs/08-conventions.md). A
// single track, not a whole release — "each card only directs to a
// song." Playback starts automatically so a real NFC tap goes
// straight from tap to sound with no extra click.

export default function TapLandingPage() {
  const params = useParams<{ code: string }>();
  const [track, setTrack] = useState<api.RedeemedTrack | null>(null);
  const [playback, setPlayback] = useState<api.PlayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  useEffect(() => {
    api
      .redeemCard(params.code)
      .then(async (redeemed) => {
        setTrack(redeemed);
        try {
          setPlayback(await api.getTrackPlayUrl(redeemed.id));
        } catch {
          // Track info still renders even if the play mint fails —
          // the player bar just won't appear; not a silent failure,
          // the rest of the page still loaded correctly.
        }
      })
      .catch((err) => {
        setError(err instanceof api.PublicApiError ? err.message : "Something went wrong.");
      });
  }, [params.code]);

  return (
    <div className="min-h-dvh bg-akosi-bg font-sans text-akosi-fg">
      <header className="flex items-center justify-between border-b border-akosi-fg/10 px-6 py-4 lg:px-10">
        <AkosiWordmark />
        <ThemeToggle />
      </header>

      {error ? (
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-akosi-accent-2/10 text-akosi-accent-2">
            <AlertTriangleIcon className="size-7" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">This card isn&apos;t working</h1>
            <p className="mt-1 text-sm text-akosi-muted-fg">{error}</p>
          </div>
        </div>
      ) : !track ? (
        <div className="flex min-h-[70vh] items-center justify-center">
          <p className="text-sm text-akosi-muted-fg">Checking card…</p>
        </div>
      ) : (
        <main className={cn("mx-auto max-w-xl px-6 py-16 text-center", playback && "pb-28")}>
          <div className="mx-auto mb-8 aspect-square w-full max-w-72 overflow-hidden rounded-lg bg-linear-to-br from-akosi-accent/20 to-akosi-accent-2/20 shadow-lg">
            {track.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.coverUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-akosi-muted-fg/60">
                {track.mediaType === "AUDIO" ? (
                  <MusicIcon className="size-10" strokeWidth={1.5} />
                ) : (
                  <VideoIcon className="size-10" strokeWidth={1.5} />
                )}
              </div>
            )}
          </div>

          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{track.title}</h1>
          <p className="mt-1 text-lg text-akosi-muted-fg">{track.artistName}</p>
          <p className="mt-0.5 text-sm text-akosi-muted-fg">{track.releaseTitle}</p>

          {track.lyrics ? (
            <div className="mt-8">
              <button
                type="button"
                onClick={() => setLyricsOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-akosi-muted-fg transition-colors hover:bg-akosi-fg/10 hover:text-akosi-fg"
              >
                Lyrics
                <ChevronDownIcon
                  className={cn("size-4 transition-transform", lyricsOpen && "rotate-180")}
                />
              </button>
              {lyricsOpen ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-akosi-muted-fg">{track.lyrics}</p>
              ) : null}
            </div>
          ) : null}
        </main>
      )}

      {track && playback ? (
        <Player
          track={{
            id: track.id,
            title: track.title,
            trackNumber: track.trackNumber,
            durationSec: track.durationSec,
            mediaType: track.mediaType,
            locked: false,
            lyrics: track.lyrics,
            coverUrl: track.coverUrl,
          }}
          playback={playback}
          onClose={() => setPlayback(null)}
        />
      ) : null}
    </div>
  );
}
