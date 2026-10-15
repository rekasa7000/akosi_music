"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, LockIcon, MusicIcon, VideoIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { CoverUploader } from "@/components/admin/catalog/cover-uploader";
import { AddTrackForm } from "@/components/admin/catalog/add-track-form";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  READY: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export default function ReleaseDetailPage() {
  const params = useParams<{ id: string }>();
  const [release, setRelease] = useState<api.ReleaseWithTracks | null>(null);
  const [artist, setArtist] = useState<api.Artist | null>(null);
  const [notFound, setNotFound] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const [titleDirty, setTitleDirty] = useState(false);
  const [titleBusy, setTitleBusy] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  useEffect(() => {
    api.getRelease(params.id).then(setRelease).catch(() => setNotFound(true));
  }, [params.id]);

  useEffect(() => {
    if (!release) return;
    api
      .listArtists()
      .then((artists) => setArtist(artists.find((a) => a.id === release.artistId) ?? null));
  }, [release?.artistId]);

  async function saveTitle() {
    if (!release) return;
    const title = titleRef.current?.value.trim() ?? "";
    if (!title || title === release.title) {
      setTitleDirty(false);
      return;
    }
    setTitleError(null);
    setTitleBusy(true);
    try {
      const updated = await api.updateRelease(release.id, { title });
      setRelease({ ...release, ...updated });
      setTitleDirty(false);
    } catch (err) {
      setTitleError(err instanceof api.AdminApiError ? err.message : "Something went wrong.");
    } finally {
      setTitleBusy(false);
    }
  }

  return (
    <AdminShell>
      {notFound ? (
        <p className="p-8 text-sm text-akosi-muted-fg">Release not found.</p>
      ) : !release ? (
        <p className="p-8 text-sm text-akosi-muted-fg">Loading…</p>
      ) : (
        <main className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <Link
            href={`/admin/artists/${release.artistId}`}
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-akosi-muted-fg transition-colors hover:text-akosi-fg"
          >
            <ArrowLeftIcon className="size-3.5" />
            Back to artist
          </Link>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[18rem_1fr]">
            <CoverUploader
              purpose="release-cover"
              currentKey={release.coverImageKey}
              onUploaded={async (coverImageKey) => {
                const updated = await api.updateRelease(release.id, { coverImageKey });
                setRelease({ ...release, ...updated });
              }}
            />

            <div className="space-y-5">
              <p className="text-sm font-medium tracking-wide text-akosi-muted-fg uppercase">
                Release
              </p>

              <div>
                <input
                  ref={titleRef}
                  defaultValue={release.title}
                  onChange={() => setTitleDirty(true)}
                  onBlur={saveTitle}
                  placeholder="Untitled release"
                  className="w-full bg-transparent font-display text-3xl font-semibold text-akosi-fg outline-none placeholder:text-akosi-muted-fg sm:text-4xl"
                />
                <div className="mt-1 flex items-center gap-2 text-sm text-akosi-muted-fg">
                  {titleBusy ? <span>Saving…</span> : null}
                  {titleDirty && !titleBusy ? <span>Click away to save</span> : null}
                  {titleError ? <span className="text-akosi-accent-2">{titleError}</span> : null}
                </div>
              </div>

              <p className="text-lg text-akosi-muted-fg">{artist?.name ?? "…"}</p>
            </div>
          </div>

          <section className="mt-16">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-medium">
                Tracks {release.tracks.length > 0 ? `(${release.tracks.length})` : ""}
              </h2>
              <Link
                href="/admin/cards"
                className="text-sm text-akosi-muted-fg underline-offset-4 hover:text-akosi-fg hover:underline"
              >
                Manage cards
              </Link>
            </div>

            {release.tracks.length > 0 ? (
              <div className="mb-8 overflow-hidden rounded-xl border border-akosi-fg/10 bg-akosi-surface">
                {release.tracks.map((track, i) => {
                  const Icon = track.mediaType === "AUDIO" ? MusicIcon : VideoIcon;
                  return (
                    <div
                      key={track.id}
                      className={cn(
                        "flex items-center gap-4 px-5 py-3.5",
                        i !== 0 && "border-t border-akosi-fg/10",
                      )}
                    >
                      <span className="w-5 shrink-0 text-right text-sm tabular-nums text-akosi-muted-fg">
                        {track.trackNumber ?? i + 1}
                      </span>
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-akosi-accent/10 text-akosi-accent-2">
                        <Icon className="size-4" />
                      </div>
                      <p className="min-w-0 flex-1 truncate font-medium">{track.title}</p>
                      {track.locked ? (
                        <Badge variant="outline" className="gap-1 border-akosi-fg/15 text-akosi-muted-fg">
                          <LockIcon className="size-3" />
                          {track.cardCount} card{track.cardCount === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-akosi-fg/15 text-akosi-muted-fg",
                          STATUS_STYLES[track.status],
                        )}
                      >
                        {track.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mb-8 text-sm text-akosi-muted-fg">No tracks yet — add the first one below.</p>
            )}

            <AddTrackForm
              releaseId={release.id}
              nextTrackNumber={release.tracks.length + 1}
              onCreated={(track) =>
                setRelease({
                  ...release,
                  tracks: [
                    ...release.tracks,
                    {
                      id: track.id,
                      title: track.title,
                      trackNumber: track.trackNumber,
                      mediaType: track.mediaType,
                      status: track.status,
                      coverImageKey: track.coverImageKey,
                      cardCount: 0,
                      locked: false,
                    },
                  ],
                })
              }
            />
          </section>
        </main>
      )}
    </AdminShell>
  );
}
