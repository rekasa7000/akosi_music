"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Maximize2Icon, MusicIcon, PauseIcon, PlayIcon, Volume2Icon, VolumeXIcon, XIcon } from "lucide-react";
import type { PlayResponse } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function useMediaPlayback(ref: RefObject<HTMLMediaElement | null>) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const el = ref.current;
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

    // Browsers block unmuted autoplay unless it chains directly off a
    // user gesture — the await in handlePlay() can lose that chain.
    // Starting muted then unmuting right after playback begins is the
    // standard workaround and keeps the click-to-play feel.
    el.muted = true;
    el.play()
      .then(() => {
        el.muted = false;
        setMuted(false);
      })
      .catch(() => {});

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("durationchange", onLoaded);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [ref]);

  function togglePlay() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  function seek(time: number) {
    const el = ref.current;
    if (!el) return;
    el.currentTime = time;
    setCurrentTime(time);
  }

  function toggleMute() {
    const el = ref.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }

  function changeVolume(v: number) {
    const el = ref.current;
    if (!el) return;
    el.volume = v;
    setVolume(v);
    if (v > 0 && el.muted) {
      el.muted = false;
      setMuted(false);
    }
  }

  return { isPlaying, currentTime, duration, volume, muted, togglePlay, seek, toggleMute, changeVolume };
}

function ProgressBar({
  value,
  max,
  onSeek,
  trackClassName,
  fillClassName,
  thumbClassName,
}: {
  value: number;
  max: number;
  onSeek: (time: number) => void;
  trackClassName: string;
  fillClassName: string;
  thumbClassName: string;
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
      className={cn("group relative h-1 w-full cursor-pointer rounded-full", trackClassName)}
    >
      <div className={cn("absolute inset-y-0 left-0 rounded-full", fillClassName)} style={{ width: `${pct}%` }} />
      <div
        className={cn(
          "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 shadow transition-opacity group-hover:opacity-100",
          thumbClassName,
        )}
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

function AudioBar({ title, playback, onClose }: { title: string; playback: PlayResponse; onClose: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const { isPlaying, currentTime, duration, volume, muted, togglePlay, seek, toggleMute, changeVolume } =
    useMediaPlayback(ref);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-akosi-fg/10 bg-akosi-surface/95 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={ref} src={playback.url} className="hidden" />
      <div className="flex items-center gap-4 px-8 py-3">
        <div className="flex w-56 shrink-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-linear-to-br from-akosi-accent to-akosi-accent-2 text-white">
            <MusicIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-akosi-fg">{title}</p>
            <p className="text-xs text-akosi-muted-fg">Admin preview</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={togglePlay}
            className="flex size-9 items-center justify-center rounded-full bg-akosi-fg text-akosi-bg transition-transform hover:scale-105"
          >
            {isPlaying ? (
              <PauseIcon className="size-4" />
            ) : (
              <PlayIcon className="size-4 translate-x-0.5" />
            )}
          </button>
          <div className="flex w-full max-w-xl items-center gap-2">
            <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-akosi-muted-fg">
              {formatTime(currentTime)}
            </span>
            <ProgressBar
              value={currentTime}
              max={duration}
              onSeek={seek}
              trackClassName="bg-akosi-fg/15"
              fillClassName="bg-akosi-accent-2"
              thumbClassName="bg-akosi-accent-2"
            />
            <span className="w-10 shrink-0 text-[11px] tabular-nums text-akosi-muted-fg">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="hidden w-40 shrink-0 items-center justify-end gap-2 sm:flex">
          <button type="button" onClick={toggleMute} className="text-akosi-muted-fg hover:text-akosi-fg">
            {muted || volume === 0 ? <VolumeXIcon className="size-4" /> : <Volume2Icon className="size-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            className="h-1 w-20 accent-akosi-accent-2"
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full p-1.5 text-akosi-muted-fg hover:bg-akosi-fg/10 hover:text-akosi-fg"
        >
          <XIcon className="size-4" />
          <span className="sr-only">Stop</span>
        </button>
      </div>
    </div>
  );
}

function VideoOverlay({ title, playback, onClose }: { title: string; playback: PlayResponse; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const { isPlaying, currentTime, duration, togglePlay, seek } = useMediaPlayback(ref);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-xl bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={ref} src={playback.url} onClick={togglePlay} className="block w-full cursor-pointer" />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-linear-to-b from-black/70 to-transparent p-4">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <XIcon className="size-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-4 pt-10">
          <ProgressBar
            value={currentTime}
            max={duration}
            onSeek={seek}
            trackClassName="bg-white/20"
            fillClassName="bg-white"
            thumbClassName="bg-white"
          />
          <div className="mt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="flex size-8 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
              >
                {isPlaying ? (
                  <PauseIcon className="size-3.5" />
                ) : (
                  <PlayIcon className="size-3.5 translate-x-0.5" />
                )}
              </button>
              <span className="text-xs tabular-nums text-white/80">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.requestFullscreen?.()}
              className="text-white/80 hover:text-white"
            >
              <Maximize2Icon className="size-4" />
              <span className="sr-only">Fullscreen</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TrackPlayer({
  title,
  playback,
  onClose,
}: {
  title: string;
  playback: PlayResponse;
  onClose: () => void;
}) {
  if (playback.mediaType === "VIDEO") {
    return <VideoOverlay title={title} playback={playback} onClose={onClose} />;
  }
  return <AudioBar title={title} playback={playback} onClose={onClose} />;
}
