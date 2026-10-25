"use client";

import { useEffect, useRef, useState } from "react";
import { MusicIcon, PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "lucide-react";
import type { MediaType } from "@/lib/public-api";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ProgressBar({
  value,
  max,
  onSeek,
}: {
  value: number;
  max: number;
  onSeek: (time: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);

  function handleSeek(clientX: number) {
    const bar = barRef.current;
    if (!bar || max <= 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeek(ratio * max);
  }

  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div
      ref={barRef}
      onClick={(e) => handleSeek(e.clientX)}
      className="group relative h-1.5 w-full cursor-pointer rounded-full bg-akosi-fg/15"
    >
      <div className="absolute inset-y-0 left-0 rounded-full bg-akosi-accent-2" style={{ width: `${pct}%` }} />
      <div
        className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-akosi-accent-2 opacity-0 shadow transition-opacity group-hover:opacity-100"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

export function NowPlayingHero({
  url,
  mediaType,
  title,
  artistName,
  coverUrl,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  url: string;
  mediaType: MediaType;
  title: string;
  artistName: string;
  coverUrl: string | null;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [coverBroken, setCoverBroken] = useState(false);

  useEffect(() => {
    const el = mediaType === "AUDIO" ? audioRef.current : videoRef.current;
    if (!el) return;

    const onTime = () => setCurrentTime(el.currentTime);
    const onLoaded = () => setDuration(el.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("durationchange", onLoaded);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);

    // Autoplay-with-sound is routinely blocked unless it chains
    // directly off a user gesture — starting muted then unmuting right
    // after playback begins is the standard workaround, same pattern
    // as the admin player.
    el.muted = true;
    el.play()
      .then(() => {
        el.muted = false;
      })
      .catch(() => {});

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("durationchange", onLoaded);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [mediaType]);

  function togglePlay() {
    const el = mediaType === "AUDIO" ? audioRef.current : videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  function seek(time: number) {
    const el = mediaType === "AUDIO" ? audioRef.current : videoRef.current;
    if (!el) return;
    el.currentTime = time;
    setCurrentTime(time);
  }

  const showCoverImage = coverUrl && !coverBroken;

  return (
    <div className="px-5 pt-5">
      {mediaType === "AUDIO" ? (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio ref={audioRef} src={url} className="hidden" />
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-linear-to-br from-akosi-accent/30 to-akosi-accent-2/30">
            {showCoverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="size-full object-cover" onError={() => setCoverBroken(true)} />
            ) : (
              <div className="flex size-full items-center justify-center text-akosi-fg/40">
                <MusicIcon className="size-16" strokeWidth={1} />
              </div>
            )}
          </div>
        </>
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video ref={videoRef} src={url} className="w-full rounded-2xl" controls={false} />
      )}

      <div className="mt-5 text-center">
        <p className="truncate text-lg font-semibold text-akosi-fg">{title}</p>
        <p className="mt-0.5 truncate text-sm text-akosi-muted-fg">{artistName}</p>
      </div>

      <div className="mt-5">
        <ProgressBar value={currentTime} max={duration} onSeek={seek} />
        <div className="mt-1.5 flex items-center justify-between text-xs tabular-nums text-akosi-muted-fg">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-8">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          className={cn("text-akosi-fg transition-opacity", !hasPrev && "opacity-30")}
        >
          <SkipBackIcon className="size-6" fill="currentColor" />
        </button>
        <button
          type="button"
          onClick={togglePlay}
          className="flex size-16 items-center justify-center rounded-full bg-akosi-accent text-white shadow-lg transition-transform hover:scale-105"
        >
          {isPlaying ? (
            <PauseIcon className="size-7" fill="currentColor" />
          ) : (
            <PlayIcon className="size-7 translate-x-0.5" fill="currentColor" />
          )}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className={cn("text-akosi-fg transition-opacity", !hasNext && "opacity-30")}
        >
          <SkipForwardIcon className="size-6" fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
