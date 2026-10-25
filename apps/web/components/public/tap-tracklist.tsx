"use client";

import { useState } from "react";
import { KeyRoundIcon, LockIcon, PauseIcon, PlayIcon } from "lucide-react";
import * as api from "@/lib/public-api";
import { TrackCodeForm } from "@/components/public/track-code-form";
import { cn } from "@/lib/utils";

export function TapTracklist({
  tracks,
  nowPlayingId,
  onSelect,
  onUnlocked,
}: {
  tracks: api.PublicTrack[];
  nowPlayingId: string | null;
  onSelect: (track: api.PublicTrack) => void;
  onUnlocked: (track: api.RedeemedTrack) => void;
}) {
  const [enteringCodeFor, setEnteringCodeFor] = useState<string | null>(null);

  return (
    <div className="divide-y divide-akosi-fg/10">
      {tracks.map((track, i) => {
        const isCurrent = track.id === nowPlayingId;
        return (
          <div key={track.id}>
            <button
              type="button"
              onClick={() =>
                track.locked
                  ? setEnteringCodeFor(enteringCodeFor === track.id ? null : track.id)
                  : onSelect(track)
              }
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
            >
              <span
                className={cn(
                  "w-4 shrink-0 text-sm tabular-nums",
                  isCurrent ? "text-akosi-accent-2" : "text-akosi-muted-fg",
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-medium",
                  track.locked ? "text-akosi-muted-fg" : isCurrent ? "text-akosi-accent-2" : "text-akosi-fg",
                )}
              >
                {track.title}
              </span>
              {track.locked ? (
                <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-akosi-muted-fg">
                  <LockIcon className="size-3.5" />
                  <KeyRoundIcon className="size-3.5" />
                </span>
              ) : isCurrent ? (
                <PauseIcon className="size-4 shrink-0 text-akosi-accent-2" fill="currentColor" />
              ) : (
                <PlayIcon className="size-4 shrink-0 text-akosi-muted-fg" />
              )}
            </button>

            {track.locked && enteringCodeFor === track.id ? (
              <div className="px-5 pb-4 pl-12">
                <TrackCodeForm
                  onUnlocked={(redeemed) => {
                    onUnlocked(redeemed);
                    setEnteringCodeFor(null);
                  }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
