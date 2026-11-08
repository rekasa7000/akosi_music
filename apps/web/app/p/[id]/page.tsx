"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangleIcon, KeyRoundIcon, MusicIcon, SmartphoneIcon } from "lucide-react";
import * as api from "@/lib/public-api";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { NowPlayingHero } from "@/components/public/now-playing-hero";
import { TapTracklist } from "@/components/public/tap-tracklist";
import { TapInfoPanel } from "@/components/public/tap-info-panel";
import { TrackCodeForm } from "@/components/public/track-code-form";
import { useIsMobileViewport } from "@/lib/use-mobile-viewport";

// The tap-landing route: the `id` in the URL identifies the release,
// not a card — it's the same URL for everyone who taps any card tied
// to this release, so it carries no unlock power on its own. Playback
// only unlocks once a fan types in the serial printed on their
// physical card via TrackCodeForm below; this page never auto-submits
// anything from the URL (docs/08-conventions.md, docs/05-nfc-authentication.md).
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
  const params = useParams<{ id: string }>();
  const isMobile = useIsMobileViewport();

  const [release, setRelease] = useState<api.PublicRelease | null>(null);
  const [nowPlayingId, setNowPlayingId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<api.PlayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getRelease(params.id)
      .then((r) => {
        if (!cancelled) setRelease(r);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof api.PublicApiError ? err.message : "Something went wrong.");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

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
    // A card's serial is tied to one specific track on one specific
    // release — if someone types in a serial from a card for a
    // different release, the redeem call still succeeds server-side,
    // but the track it returns won't be in this release's tracklist.
    // Without this check, that silently breaks `nowPlayingTrack`
    // lookup instead of surfacing why.
    if (!release || !release.tracks.some((t) => t.id === redeemed.id)) {
      throw new api.PublicApiError("That serial is for a different release.");
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
      ) : !release ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-akosi-muted-fg">Loading…</p>
        </div>
      ) : (
        <>
          {playback && nowPlayingTrack ? (
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
            <div className="px-5 pt-5">
              <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-akosi-accent/20 to-akosi-accent-2/20">
                {release.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={release.coverUrl} alt="" className="size-full object-cover opacity-30 blur-sm" />
                ) : null}
                <div className="absolute flex size-16 items-center justify-center rounded-full bg-akosi-bg/80 text-akosi-fg/70">
                  {nowPlayingId ? (
                    <MusicIcon className="size-7" strokeWidth={1.5} />
                  ) : (
                    <KeyRoundIcon className="size-7" strokeWidth={1.5} />
                  )}
                </div>
              </div>

              <div className="mt-5 text-center">
                <p className="truncate text-lg font-semibold text-akosi-fg">{release.title}</p>
                <p className="mt-0.5 truncate text-sm text-akosi-muted-fg">{release.artistName}</p>
              </div>

              {!nowPlayingId ? (
                <div className="mt-6 rounded-xl border-2 border-akosi-fg/10 bg-akosi-surface p-5">
                  <p className="font-display text-base font-semibold text-akosi-fg">
                    Enter your card&apos;s serial
                  </p>
                  <p className="mt-1 text-sm text-akosi-muted-fg">
                    Type the code printed on your physical card to unlock its track.
                  </p>
                  <div className="mt-4">
                    <TrackCodeForm onUnlocked={handleUnlocked} />
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex items-center justify-center">
                  <p className="text-sm text-akosi-muted-fg">Loading…</p>
                </div>
              )}
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

          {nowPlayingTrack ? (
            <div className="border-t-2 border-akosi-fg/10">
              <TapInfoPanel
                artist={release.artist}
                lyrics={nowPlayingTrack.lyrics}
                releaseId={release.id}
                trackId={nowPlayingTrack.id}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
