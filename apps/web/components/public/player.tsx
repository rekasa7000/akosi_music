"use client";

import { XIcon } from "lucide-react";
import type { PlayResponse, PublicTrack } from "@/lib/public-api";

export function Player({
  track,
  playback,
  onClose,
}: {
  track: PublicTrack;
  playback: PlayResponse;
  onClose: () => void;
}) {
  if (playback.mediaType === "VIDEO") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-8"
        onClick={onClose}
      >
        <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={playback.url} controls autoPlay className="w-full rounded-lg shadow-2xl" />
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-10 right-0 rounded-full p-1.5 text-white/80 hover:text-white"
          >
            <XIcon className="size-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-akosi-fg/10 bg-akosi-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3 lg:px-10">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-akosi-bg">
          {track.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.coverUrl} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <p className="w-32 shrink-0 truncate text-sm font-medium text-akosi-fg sm:w-48">
          {track.title}
        </p>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio src={playback.url} controls autoPlay className="h-10 min-w-0 flex-1" />
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
