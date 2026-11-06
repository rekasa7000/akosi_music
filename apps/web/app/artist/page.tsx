"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DiscIcon, Music2Icon, MusicIcon } from "lucide-react";
import * as api from "@/lib/artist-api";
import { ArtistShell } from "@/components/artist/artist-shell";
import { StageLight } from "@/components/admin/stage-light";
import { StatTile } from "@/components/admin/stat-tile";
import { Badge } from "@/components/ui/badge";
import { NewReleaseDialog } from "@/components/artist/new-release-dialog";
import { FOIL_SWEEPS } from "@/lib/foil-sweeps";
import { cn } from "@/lib/utils";

export default function ArtistDashboardPage() {
  const router = useRouter();
  const [releases, setReleases] = useState<api.ReleaseSummary[] | null>(null);
  // Presigned cover URLs can 404 (e.g. storage object missing/expired) —
  // tracked per-release so one broken cover falls back to the placeholder
  // instead of showing the browser's broken-image icon.
  const [brokenCovers, setBrokenCovers] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.listReleases().then(setReleases);
  }, []);

  function goToNewRelease(release: api.Release) {
    router.push(`/artist/releases/${release.id}`);
  }

  const trackCount = releases?.reduce((sum, r) => sum + r.trackCount, 0) ?? 0;

  return (
    <ArtistShell>
      <div className="px-8 py-10">
        {/* The one ambient moment on this page — same confined stage-light
            glow as the admin portal's dashboard/roster heroes. */}
        <div className="relative mb-8 overflow-hidden rounded-3xl border-2 border-akosi-fg/15">
          <StageLight />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -bottom-14 font-display text-[9rem] leading-none font-bold text-akosi-fg/5 select-none"
          >
            ♪
          </span>
          <div className="relative flex flex-wrap items-center justify-between gap-4 px-8 py-10">
            <div>
              <p className="font-display text-xs font-semibold tracking-[0.2em] text-akosi-accent-2 uppercase">
                akosi artist portal
              </p>
              <h1 className="mt-1 font-display text-4xl font-bold lowercase leading-[0.95]">Dashboard</h1>
              <p className="mt-2 text-sm text-akosi-muted-fg">Your releases and tracks.</p>
            </div>
            <NewReleaseDialog onCreated={goToNewRelease} />
          </div>
        </div>

        {releases === null ? (
          <p className="text-sm text-akosi-muted-fg">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile icon={DiscIcon} label="Releases" value={releases.length} accent="accent" tilt={-1} />
            <StatTile icon={Music2Icon} label="Tracks" value={trackCount} accent="accent-2" tilt={1} />
          </div>
        )}

        <section className="mt-10">
          <h2 className="mb-4 font-display text-lg font-semibold">Your releases</h2>
          {releases === null ? (
            <p className="text-sm text-akosi-muted-fg">Loading…</p>
          ) : releases.length === 0 ? (
            <p className="text-sm text-akosi-muted-fg">
              No releases yet — create one above, then add tracks to it.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {releases.map((release, idx) => {
                const hasCover = Boolean(release.coverUrl) && !brokenCovers.has(release.id);
                return (
                <Link
                  key={release.id}
                  href={`/artist/releases/${release.id}`}
                  className={cn(
                    "group rounded-2xl border-2 border-akosi-fg/15 bg-akosi-surface p-3 transition-all duration-300 hover:-translate-y-1 hover:rotate-0 hover:border-akosi-accent-2/40 hover:shadow-[0_20px_40px_-24px] hover:shadow-akosi-accent/40",
                    idx % 2 === 0 ? "-rotate-1" : "rotate-1",
                  )}
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
