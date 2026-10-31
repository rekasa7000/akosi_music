"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangleIcon, SmartphoneIcon } from "lucide-react";
import * as api from "@/lib/public-api";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { NowPlayingHero } from "@/components/public/now-playing-hero";
import { TapTracklist } from "@/components/public/tap-tracklist";
import { TapInfoPanel } from "@/components/public/tap-info-panel";
import { useIsMobileViewport } from "@/lib/use-mobile-viewport";

// The tap-landing route: this page's only job is forwarding the
// card's code to the API and rendering what comes back, never
// constructing a storage URL itself (docs/08-conventions.md).
//
// Fixed dark theme (the "dark" class forced on the root below,
// independent of the site-wide light/dark toggle) — a Now Playing
// screen reads as a dark surface regardless of viewer preference, the
// same way Spotify's now-playing view doesn't follow OS theme.
//
// Mobile-only per client instruction: there's no reliable server-side
// device signal for this route, so viewport width is the actual,
// checkable thing "mobile device" means here.

function DesktopBlocked() {
  return (
    <div className="dark flex min-h-dvh flex-col items-center justify-center gap-4 bg-akosi-bg px-6 text-center font-sans">
      <AkosiWordmark size="lg" />
      <div className="mt-4 flex size-14 items-center justify-center rounded-full bg-akosi-accent/15 text-akosi-accent-2">
        <SmartphoneIcon className="size-6" strokeWidth={1.5} />
      </div>
      <div>
        <h1 className="font-display text-xl font-semibold text-akosi-fg">Open this on your phone</h1>
        <p className="mt-1.5 max-w-xs text-sm text-akosi-muted-fg">
          This page is the screen your card opens to — tap it with your phone to unlock the music.
        </p>
      </div>
    </div>
  );
}

export default function TapLandingPage() {
  const params = useParams<{ code: string }>();
  const isMobile = useIsMobileViewport();

  const [release, setRelease] = useState<api.PublicRelease | null>(null);
  const [nowPlayingId, setNowPlayingId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<api.PlayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .redeemCard(params.code)
      .then((redeemed) => {
        if (cancelled) return;
        setNowPlayingId(redeemed.id);
        return api.getRelease(redeemed.releaseId).then((r) => {
          if (!cancelled) setRelease(r);
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof api.PublicApiError ? err.message : "Something went wrong.");
      });
    return () => {
      cancelled = true;
    };
  }, [params.code]);

  useEffect(() => {
    if (!nowPlayingId) return;
    let cancelled = false;
    api
      .getTrackPlayUrl(nowPlayingId)
      .then((p) => {
        if (!cancelled) setPlayback(p);
      })
      .catch(() => {
        if (!cancelled) setPlayback(null);
      });
    return () => {
      cancelled = true;
    };
  }, [nowPlayingId]);

  const tracks = release?.tracks ?? [];
  const currentIndex = tracks.findIndex((t) => t.id === nowPlayingId);
  const nowPlayingTrack = currentIndex >= 0 ? tracks[currentIndex] : null;

  // A release's tracklist is small (a handful of tracks), so scanning
  // it on every render is cheap enough that memoizing would just be
  // ceremony — and an unstable `tracks` reference (new array each
  // render from `release?.tracks ?? []`) would defeat it anyway.
  let prevIndex = -1;
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (!tracks[i].locked) {
      prevIndex = i;
      break;
    }
  }
  let nextIndex = -1;
  for (let i = currentIndex + 1; i < tracks.length; i++) {
    if (!tracks[i].locked) {
      nextIndex = i;
      break;
    }
  }

  function handleUnlocked(redeemed: api.RedeemedTrack) {
    // A card code is tied to one specific track on one specific
    // release — if someone types in a code from a different card, the
    // redeem call still succeeds server-side, but the track it returns
    // won't be in this release's tracklist. Without this check, that
    // silently breaks `nowPlayingTrack` lookup instead of surfacing why.
    if (!release || !release.tracks.some((t) => t.id === redeemed.id)) {
      throw new api.PublicApiError("That code is for a different release.");
    }
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
    setNowPlayingId(redeemed.id);
  }

  // Avoid flashing the real page before the viewport is knowable, and
  // block anything that isn't phone-width per the client's instruction.
  if (isMobile === null) return null;
  if (isMobile === false) return <DesktopBlocked />;

  return (
    <div className="dark min-h-dvh bg-akosi-bg font-sans text-akosi-fg">
      <header className="flex flex-col items-center gap-1 pt-6 pb-2">
        <AkosiWordmark />
        <span className="rounded-full bg-akosi-fg/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-akosi-muted-fg uppercase">
          Beta
        </span>
      </header>

      {error ? (
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-akosi-accent-2/10 text-akosi-accent-2">
            <AlertTriangleIcon className="size-7" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">This card isn&apos;t working</h1>
            <p className="mt-1 text-sm text-akosi-muted-fg">{error}</p>
          </div>
        </div>
      ) : !release || !nowPlayingTrack ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-akosi-muted-fg">Checking card…</p>
        </div>
      ) : (
        <>
          {playback ? (
            <NowPlayingHero
              key={nowPlayingTrack.id}
              url={playback.url}
              mediaType={playback.mediaType}
              title={nowPlayingTrack.title}
              artistName={release.artist.name}
              coverUrl={nowPlayingTrack.coverUrl}
              onPrev={() => prevIndex >= 0 && setNowPlayingId(tracks[prevIndex].id)}
              onNext={() => nextIndex >= 0 && setNowPlayingId(tracks[nextIndex].id)}
              hasPrev={prevIndex >= 0}
              hasNext={nextIndex >= 0}
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center px-5 pt-5">
              <div className="flex size-full items-center justify-center rounded-2xl bg-akosi-surface">
                <p className="text-sm text-akosi-muted-fg">Loading…</p>
              </div>
            </div>
          )}

          <div className="mt-6 border-t-2 border-akosi-fg/10">
            <TapTracklist
              tracks={tracks}
              nowPlayingId={nowPlayingId}
              onSelect={(track) => setNowPlayingId(track.id)}
              onUnlocked={handleUnlocked}
            />
          </div>

          <div className="border-t-2 border-akosi-fg/10">
            <TapInfoPanel
              artist={release.artist}
              lyrics={nowPlayingTrack.lyrics}
              releaseId={release.id}
              trackId={nowPlayingTrack.id}
            />
          </div>
        </>
      )}
    </div>
  );
}
