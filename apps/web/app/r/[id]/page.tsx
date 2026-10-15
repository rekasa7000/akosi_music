"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ChevronDownIcon,
  KeyRoundIcon,
  Loader2Icon,
  LockIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  VideoIcon,
} from "lucide-react";
import * as api from "@/lib/public-api";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Player } from "@/components/public/player";
import { TrackCodeForm } from "@/components/public/track-code-form";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PublicReleasePage() {
  const params = useParams<{ id: string }>();
  const [release, setRelease] = useState<api.PublicRelease | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [playing, setPlaying] = useState<{ track: api.PublicTrack; playback: api.PlayResponse } | null>(
    null,
  );
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [expandedLyrics, setExpandedLyrics] = useState<string | null>(null);
  const [enteringCodeFor, setEnteringCodeFor] = useState<string | null>(null);

  useEffect(() => {
    api.getRelease(params.id).then(setRelease).catch(() => setNotFound(true));
  }, [params.id]);

  function handleUnlocked(redeemed: api.RedeemedTrack) {
    setEnteringCodeFor(null);
    setRelease((prev) =>
      prev
        ? {
            ...prev,
            tracks: prev.tracks.map((t) =>
              t.id === redeemed.id
                ? {
                    id: redeemed.id,
                    title: redeemed.title,
                    trackNumber: redeemed.trackNumber,
                    durationSec: redeemed.durationSec,
                    mediaType: redeemed.mediaType,
                    locked: false,
                    lyrics: redeemed.lyrics,
                    coverUrl: redeemed.coverUrl,
                  }
                : t,
            ),
          }
        : prev,
    );
  }

  async function handlePlay(track: api.PublicTrack) {
    if (playing?.track.id === track.id) {
      setPlaying(null);
      return;
    }
    setPlayError(null);
    setLoadingTrackId(track.id);
    try {
      const playback = await api.getTrackPlayUrl(track.id);
      setPlaying({ track, playback });
    } catch (err) {
      setPlayError(err instanceof api.PublicApiError ? err.message : "Couldn't play this track.");
    } finally {
      setLoadingTrackId(null);
    }
  }

  if (notFound) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-akosi-bg font-sans text-akosi-fg">
        <p className="text-sm text-akosi-muted-fg">Release not found.</p>
      </div>
    );
  }

  if (!release) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-akosi-bg font-sans text-akosi-fg">
      <header className="flex items-center justify-between border-b border-akosi-fg/10 px-6 py-4 lg:px-10">
        <AkosiWordmark />
        <ThemeToggle />
      </header>

      <main
        className={cn(
          "mx-auto max-w-7xl px-6 py-12 lg:px-10",
          playing?.playback.mediaType === "AUDIO" && "pb-28",
        )}
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[18rem_1fr] lg:items-end">
          <div className="aspect-square w-full max-w-64 overflow-hidden rounded-lg bg-linear-to-br from-akosi-accent/20 to-akosi-accent-2/20 shadow-lg">
            {release.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={release.coverUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-akosi-muted-fg/60">
                <MusicIcon className="size-10" strokeWidth={1.5} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium tracking-wide text-akosi-muted-fg uppercase">
              Release
            </p>
            <h1 className="font-display text-3xl font-semibold sm:text-5xl">{release.title}</h1>
            <p className="text-lg text-akosi-muted-fg">{release.artistName}</p>
          </div>
        </div>

        <section className="mt-14">
          {release.tracks.length === 0 ? (
            <p className="text-sm text-akosi-muted-fg">No tracks yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-akosi-fg/10 bg-akosi-surface">
              {release.tracks.map((track, i) => {
                const isPlaying = playing?.track.id === track.id;
                const isLoading = loadingTrackId === track.id;
                const hasLyrics = Boolean(track.lyrics);
                const lyricsOpen = expandedLyrics === track.id;
                const MediaIcon = track.mediaType === "AUDIO" ? MusicIcon : VideoIcon;
                const duration = formatDuration(track.durationSec);

                return (
                  <div key={track.id} className={cn(i !== 0 && "border-t border-akosi-fg/10")}>
                    <div className="flex items-center gap-4 px-5 py-3.5">
                      {track.locked ? (
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-akosi-fg/10 text-akosi-muted-fg">
                          <LockIcon className="size-4" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePlay(track)}
                          disabled={isLoading}
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
                            isPlaying
                              ? "bg-akosi-accent text-white"
                              : "bg-akosi-accent/10 text-akosi-accent-2 hover:bg-akosi-accent/20",
                          )}
                        >
                          {isLoading ? (
                            <Loader2Icon className="size-4 animate-spin" />
                          ) : isPlaying ? (
                            <PauseIcon className="size-4" />
                          ) : (
                            <PlayIcon className="size-4" />
                          )}
                        </button>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate font-medium", track.locked && "text-akosi-muted-fg")}>
                          {track.title}
                        </p>
                      </div>

                      {track.locked ? (
                        <button
                          type="button"
                          onClick={() =>
                            setEnteringCodeFor(enteringCodeFor === track.id ? null : track.id)
                          }
                          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-akosi-muted-fg transition-colors hover:bg-akosi-fg/10 hover:text-akosi-fg"
                        >
                          <KeyRoundIcon className="size-3.5" />
                          Enter code
                        </button>
                      ) : (
                        <>
                          <MediaIcon className="size-4 shrink-0 text-akosi-muted-fg" />
                          {duration ? (
                            <span className="shrink-0 text-sm tabular-nums text-akosi-muted-fg">
                              {duration}
                            </span>
                          ) : null}
                          {hasLyrics ? (
                            <button
                              type="button"
                              onClick={() => setExpandedLyrics(lyricsOpen ? null : track.id)}
                              className="shrink-0 rounded-full p-1.5 text-akosi-muted-fg hover:bg-akosi-fg/10 hover:text-akosi-fg"
                            >
                              <ChevronDownIcon
                                className={cn(
                                  "size-4 transition-transform",
                                  lyricsOpen && "rotate-180",
                                )}
                              />
                              <span className="sr-only">Lyrics</span>
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>

                    {track.locked && enteringCodeFor === track.id ? (
                      <div className="px-5 pb-4 pl-17">
                        <TrackCodeForm onUnlocked={handleUnlocked} />
                      </div>
                    ) : null}

                    {!track.locked && lyricsOpen ? (
                      <p className="whitespace-pre-wrap px-5 pb-4 pl-17 text-sm text-akosi-muted-fg">
                        {track.lyrics}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {playError ? <p className="mt-3 text-sm text-akosi-accent-2">{playError}</p> : null}
        </section>
      </main>

      {playing ? (
        <Player track={playing.track} playback={playing.playback} onClose={() => setPlaying(null)} />
      ) : null}
    </div>
  );
}
