"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, Loader2Icon, PauseIcon, PencilIcon, PlayIcon } from "lucide-react";
import * as api from "@/lib/artist-api";
import { ArtistShell } from "@/components/artist/artist-shell";
import { Badge } from "@/components/ui/badge";
import { CoverUploader } from "@/components/admin/catalog/cover-uploader";
import { AddTrackForm } from "@/components/admin/catalog/add-track-form";
import { EditTrackDialog } from "@/components/admin/catalog/edit-track-dialog";
import { TrackPlayer } from "@/components/admin/track-player";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  READY: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export default function ArtistReleaseDetailPage() {
  const params = useParams<{ id: string }>();
  const [release, setRelease] = useState<api.ReleaseWithTracks | null>(null);
  const [notFound, setNotFound] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const [titleDirty, setTitleDirty] = useState(false);
  const [titleBusy, setTitleBusy] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<api.PlayResponse & { trackId: string }>();
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);

  useEffect(() => {
    api.getRelease(params.id).then(setRelease).catch(() => setNotFound(true));
  }, [params.id]);

  async function handlePlay(track: { id: string }) {
    if (playing?.trackId === track.id) {
      setPlaying(undefined);
      return;
    }
    setLoadingTrackId(track.id);
    try {
      const playback = await api.getTrackPlayUrl(track.id);
      setPlaying({ ...playback, trackId: track.id });
    } finally {
      setLoadingTrackId(null);
    }
  }

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
      setTitleError(err instanceof api.ArtistApiError ? err.message : "Something went wrong.");
    } finally {
      setTitleBusy(false);
    }
  }

  return (
    <ArtistShell>
      {notFound ? (
        <p className="p-8 text-sm text-akosi-muted-fg">Release not found.</p>
      ) : !release ? (
        <p className="p-8 text-sm text-akosi-muted-fg">Loading…</p>
      ) : (
        <main className="px-8 py-10">
          <Link
            href="/artist"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-akosi-muted-fg transition-colors hover:text-akosi-fg"
          >
            <ArrowLeftIcon className="size-3.5" />
            Back to dashboard
          </Link>

          <div className="grid grid-cols-1 gap-10 border-b-2 border-akosi-fg/10 pb-10 lg:grid-cols-[18rem_1fr]">
            <CoverUploader
              purpose="release-cover"
              uploadMedia={api.uploadMedia}
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
                  className="w-full bg-transparent font-display text-3xl font-bold text-akosi-fg outline-none placeholder:text-akosi-muted-fg sm:text-5xl"
                />
                <div className="mt-1 flex items-center gap-2 text-sm text-akosi-muted-fg">
                  {titleBusy ? <span>Saving…</span> : null}
                  {titleDirty && !titleBusy ? <span>Click away to save</span> : null}
                  {titleError ? <span className="text-akosi-accent-2">{titleError}</span> : null}
                </div>
              </div>
            </div>
          </div>

          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">
                Tracks {release.tracks.length > 0 ? `(${release.tracks.length})` : ""}
              </h2>
            </div>

            {release.tracks.length > 0 ? (
              <div className="mb-8 space-y-3">
                {release.tracks.map((track, i) => {
                  const isPlaying = playing?.trackId === track.id;
                  const isLoading = loadingTrackId === track.id;
                  return (
                    <div
                      key={track.id}
                      className="relative flex items-center gap-4 overflow-hidden rounded-xl border-2 border-akosi-fg/10 bg-akosi-surface py-3.5 pr-5 pl-6"
                    >
                      <span className="w-5 shrink-0 text-right text-sm font-semibold tabular-nums text-akosi-muted-fg">
                        {track.trackNumber ?? i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePlay(track)}
                        disabled={isLoading}
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-md transition-colors",
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
                      <p className="min-w-0 flex-1 truncate font-medium">{track.title}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-akosi-fg/15 text-akosi-muted-fg",
                          STATUS_STYLES[track.status],
                        )}
                      >
                        {track.status}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => setEditingTrackId(track.id)}
                        className="shrink-0 rounded-full p-1.5 text-akosi-muted-fg transition-colors hover:bg-akosi-fg/10 hover:text-akosi-fg"
                      >
                        <PencilIcon className="size-3.5" />
                        <span className="sr-only">Edit track</span>
                      </button>
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
              uploadMedia={api.uploadMedia}
              createTrack={api.createTrack}
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
                      lyrics: track.lyrics,
                      coverImageKey: track.coverImageKey,
                    },
                  ],
                })
              }
            />
          </section>
        </main>
      )}
      {playing ? (
        <TrackPlayer key={playing.trackId} playback={playing} onClose={() => setPlaying(undefined)} />
      ) : null}
      {release && editingTrackId ? (
        <EditTrackDialog
          track={release.tracks.find((t) => t.id === editingTrackId)!}
          open={true}
          onOpenChange={(next) => {
            if (!next) setEditingTrackId(null);
          }}
          uploadMedia={api.uploadMedia}
          updateTrack={api.updateTrack}
          onUpdated={(updated) =>
            setRelease({
              ...release,
              tracks: release.tracks.map((t) => (t.id === updated.id ? updated : t)),
            })
          }
        />
      ) : null}
    </ArtistShell>
  );
}
