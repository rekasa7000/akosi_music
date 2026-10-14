"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as api from "@/lib/admin-api";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CoverUploader } from "@/components/admin/catalog/cover-uploader";
import { VisibilityControl } from "@/components/admin/catalog/visibility-control";
import { AddTrackForm } from "@/components/admin/catalog/add-track-form";

export default function ReleaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [release, setRelease] = useState<api.ReleaseWithTracks | null>(null);
  const [artist, setArtist] = useState<api.Artist | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [titleBusy, setTitleBusy] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(() => setAuthed(true))
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  useEffect(() => {
    if (!authed) return;
    api.getRelease(params.id).then(setRelease).catch(() => setNotFound(true));
  }, [authed, params.id]);

  useEffect(() => {
    if (!release) return;
    api
      .listArtists()
      .then((artists) => setArtist(artists.find((a) => a.id === release.artistId) ?? null));
  }, [release?.artistId]);

  async function handleTitleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!release) return;
    const title = String(new FormData(e.currentTarget).get("title") ?? "").trim();
    if (!title || title === release.title) return;
    setTitleError(null);
    setTitleBusy(true);
    try {
      const updated = await api.updateRelease(release.id, { title });
      setRelease({ ...release, ...updated });
    } catch (err) {
      setTitleError(err instanceof api.AdminApiError ? err.message : "Something went wrong.");
    } finally {
      setTitleBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-akosi-bg font-sans text-akosi-fg">
        <p className="text-sm text-akosi-muted-fg">Release not found.</p>
      </div>
    );
  }

  if (!authed || !release) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-akosi-bg font-sans text-akosi-fg">
      <header className="flex items-center justify-between border-b border-akosi-fg/10 px-6 py-4">
        <AkosiWordmark />
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-2xl space-y-10 px-6 py-16">
        <Link href="/admin" className="text-sm text-akosi-muted-fg hover:text-akosi-fg">
          ← Back to dashboard
        </Link>

        <div className="space-y-4">
          <p className="text-sm text-akosi-muted-fg">{artist?.name ?? "…"}</p>
          <form className="flex items-end gap-2" onSubmit={handleTitleSubmit}>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="release-title">Title</Label>
              <Input id="release-title" name="title" defaultValue={release.title} />
            </div>
            <Button
              type="submit"
              disabled={titleBusy}
              variant="outline"
              className="border-akosi-fg/15 bg-transparent! text-akosi-fg! hover:bg-akosi-fg/10!"
            >
              {titleBusy ? "Saving…" : "Save"}
            </Button>
          </form>
          {titleError ? <p className="text-sm text-akosi-accent-2">{titleError}</p> : null}

          <div>
            <Label className="mb-1.5 block">Cover</Label>
            <CoverUploader
              currentKey={release.coverImageKey}
              onUploaded={async (coverImageKey) => {
                const updated = await api.updateRelease(release.id, { coverImageKey });
                setRelease({ ...release, ...updated });
              }}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Visibility</Label>
            <VisibilityControl
              release={release}
              onUpdated={(updated) => setRelease({ ...release, ...updated })}
            />
          </div>
        </div>

        <section>
          <h2 className="mb-4 font-display text-lg font-medium">
            Tracks {release.tracks.length > 0 ? `(${release.tracks.length})` : ""}
          </h2>
          {release.tracks.length > 0 ? (
            <ul className="mb-6 divide-y divide-akosi-fg/10 rounded-md border border-akosi-fg/10 bg-akosi-surface">
              {release.tracks.map((track) => (
                <li key={track.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium">
                      {track.trackNumber ? `${track.trackNumber}. ` : ""}
                      {track.title}
                    </p>
                    <p className="text-sm text-akosi-muted-fg">{track.mediaType}</p>
                  </div>
                  <Badge variant="outline" className="border-akosi-fg/15 text-akosi-muted-fg">
                    {track.status}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-6 text-sm text-akosi-muted-fg">No tracks yet.</p>
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
                  },
                ],
              })
            }
          />
        </section>
      </main>
    </div>
  );
}
