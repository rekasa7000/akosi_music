"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DiscIcon, HeartIcon, MusicIcon, PlayIcon, WalletCardsIcon } from "lucide-react";
import * as api from "@/lib/artist-api";
import { ArtistShell } from "@/components/artist/artist-shell";
import { StageLight } from "@/components/admin/stage-light";
import { ActivityMarquee } from "@/components/dash/activity-marquee";
import { HeroStatRow, HeroStatTile } from "@/components/dash/hero-stat-tile";
import { EmptyState } from "@/components/dash/empty-state";
import { Badge } from "@/components/ui/badge";
import { NewReleaseDialog } from "@/components/artist/new-release-dialog";
import { FOIL_SWEEPS } from "@/lib/foil-sweeps";
import { cn } from "@/lib/utils";

export default function ArtistDashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<api.Me | null>(null);
  const [stats, setStats] = useState<api.ArtistStats | null>(null);
  const [releases, setReleases] = useState<api.ReleaseSummary[] | null>(null);
  // Presigned cover URLs can 404 (e.g. storage object missing/expired) —
  // tracked per-release so one broken cover falls back to the placeholder
  // instead of showing the browser's broken-image icon.
  const [brokenCovers, setBrokenCovers] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.me().then(setMe).catch(() => {});
    api.getStats().then(setStats);
    api.listReleases().then(setReleases);
  }, []);

  function goToNewRelease(release: api.Release) {
    router.push(`/artist/releases/${release.id}`);
  }

  // Latest-activity ticker — real numbers only, zeros skipped.
  const tickerItems = stats
    ? [
        stats.playsToday > 0 ? `${stats.playsToday} plays today` : null,
        stats.totalPlays > 0 ? `${stats.totalPlays.toLocaleString()} plays all-time` : null,
        stats.ownerCount > 0 ? `${stats.ownerCount} card owner${stats.ownerCount === 1 ? "" : "s"}` : null,
        stats.cardsByStatus.UNCLAIMED > 0 ? `${stats.cardsByStatus.UNCLAIMED} cards still unclaimed` : null,
        releases?.[0] ? `latest release: ${releases[0].title}` : null,
      ].filter((item): item is string => item !== null)
    : [];

  const firstName = me?.artistName.split(/\s+/)[0] ?? null;

  return (
    <ArtistShell>
      <div className="px-4 py-6 sm:px-8 sm:py-10">
        {/* Hero greeting — the artist's own name is the headline act,
            set in oversized display type over the stage light. */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-akosi-fg/15">
          <StageLight />
          <span
            aria-hidden="true"
            className="akosi-header-word pointer-events-none absolute -right-2 bottom-[-0.35em] text-[clamp(5rem,22vw,13rem)] whitespace-nowrap select-none"
          >
            {me?.artistName ?? "akosi"}
          </span>
          <div aria-hidden="true" className="akosi-grain pointer-events-none absolute inset-0" />
          <div className="relative flex flex-wrap items-end justify-between gap-4 px-5 py-8 sm:px-8 sm:py-12">
            <div className="min-w-0">
              <p className="font-display text-xs font-semibold tracking-[0.2em] text-akosi-accent-2 uppercase">
                akosi artist portal
              </p>
              <h1 className="mt-1 font-display text-[clamp(2.5rem,8vw,4rem)] leading-[0.95] font-bold tracking-tight">
                {firstName ? (
                  <>
                    good to see you,
                    <br />
                    <span className="text-akosi-accent-2">{me!.artistName}</span>
                  </>
                ) : (
                  "welcome back"
                )}
              </h1>
              <p className="mt-3 max-w-prose text-base text-akosi-muted-fg">
                Tonight&apos;s numbers — your releases, your cards, your crowd.
              </p>
            </div>
            <NewReleaseDialog onCreated={goToNewRelease} />
          </div>
        </div>

        {tickerItems.length > 0 ? (
          <div className="mt-4">
            <ActivityMarquee items={tickerItems} />
          </div>
        ) : null}

        {stats === null ? (
          <p className="mt-8 text-sm text-akosi-muted-fg">Loading…</p>
        ) : (
          <div className="mt-6">
            <HeroStatRow>
              {/* The screen's single highlight: today's plays, stamped
                  on the plays tile. */}
              <HeroStatTile
                label="Plays"
                value={stats.totalPlays}
                icon={PlayIcon}
                sweep="ember"
                tilt={-2}
                highlight
                highlightNote={`${stats.playsToday.toLocaleString()} today`}
              />
              <HeroStatTile
                label="Card owners"
                value={stats.ownerCount}
                icon={HeartIcon}
                sweep="plum"
                delay={60}
              />
              <HeroStatTile
                label="Cards in the world"
                value={stats.cardCount}
                icon={WalletCardsIcon}
                sweep="flare"
                tilt={1}
                delay={120}
              />
              <HeroStatTile
                label="Releases"
                value={stats.releaseCount}
                icon={DiscIcon}
                sweep="plum"
                delay={180}
              />
            </HeroStatRow>
          </div>
        )}

        <section className="mt-8">
          <h2 className="mb-4 font-display text-lg font-semibold">Your releases</h2>
          {releases === null ? (
            <p className="text-sm text-akosi-muted-fg">Loading…</p>
          ) : releases.length === 0 ? (
            <EmptyState
              title="your stage is set"
              body="No releases yet. Create your first one, add tracks, and your cards get something to unlock."
              sweep="plum"
              cta={<NewReleaseDialog onCreated={goToNewRelease} />}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {releases.map((release, idx) => {
                const hasCover = Boolean(release.coverUrl) && !brokenCovers.has(release.id);
                return (
                  <Link
                    key={release.id}
                    href={`/artist/releases/${release.id}`}
                    className={cn(
                      "group akosi-rise rounded-2xl border-2 border-akosi-fg/15 bg-akosi-surface p-3 transition-all duration-300 hover:-translate-y-1 hover:border-akosi-accent-2/40 hover:shadow-[0_20px_40px_-24px] hover:shadow-akosi-accent/40 lg:hover:rotate-0",
                      idx % 2 === 0 ? "lg:-rotate-1" : "lg:rotate-1",
                    )}
                    style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}
                  >
                    <div
                      className="relative mb-3 aspect-square overflow-hidden rounded-xl"
                      style={!hasCover ? { background: FOIL_SWEEPS[idx % FOIL_SWEEPS.length] } : undefined}
                    >
                      {hasCover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={release.coverUrl!}
                          alt=""
                          className="size-full object-cover"
                          onError={() => setBrokenCovers((prev) => new Set(prev).add(release.id))}
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-white/80">
                          <MusicIcon className="size-8" strokeWidth={1.5} />
                        </div>
                      )}
                      <div aria-hidden="true" className="akosi-foil-shine pointer-events-none absolute inset-0" />
                      <Badge className="absolute top-2 right-2 border-none bg-black/60 text-[10px] text-white backdrop-blur-sm">
                        {release.trackCount} track{release.trackCount === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <p className="truncate font-medium group-hover:text-akosi-accent-2">{release.title}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </ArtistShell>
  );
}
