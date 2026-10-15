"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, LockIcon, MusicIcon, VideoIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function ArtistDetailPage() {
  const params = useParams<{ id: string }>();
  const [artist, setArtist] = useState<api.ArtistDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.getArtist(params.id).then(setArtist).catch(() => setNotFound(true));
  }, [params.id]);

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl px-8 py-12">
        <Link
          href="/admin/artists"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-akosi-muted-fg transition-colors hover:text-akosi-fg"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to artists
        </Link>

        {notFound ? (
          <p className="text-sm text-akosi-muted-fg">Artist not found.</p>
        ) : !artist ? (
          <p className="text-sm text-akosi-muted-fg">Loading…</p>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold">{artist.name}</h1>
            {artist.bio ? (
              <p className="mt-2 max-w-xl text-sm text-akosi-muted-fg">{artist.bio}</p>
            ) : null}

            <div className="mt-10 space-y-8">
              {artist.releases.length === 0 ? (
                <p className="text-sm text-akosi-muted-fg">No releases yet.</p>
              ) : (
                artist.releases.map((release) => (
                  <section key={release.id}>
                    <Link
                      href={`/admin/releases/${release.id}`}
                      className="mb-3 inline-block font-display text-lg font-medium hover:underline"
                    >
                      {release.title}
                    </Link>
                    {release.tracks.length === 0 ? (
                      <p className="text-sm text-akosi-muted-fg">No tracks yet.</p>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-akosi-fg/10 bg-akosi-surface">
                        {release.tracks.map((track, i) => {
                          const Icon = track.mediaType === "AUDIO" ? MusicIcon : VideoIcon;
                          return (
                            <div
                              key={track.id}
                              className={cn(
                                "flex items-center gap-4 px-5 py-3",
                                i !== 0 && "border-t border-akosi-fg/10",
                              )}
                            >
                              <Icon className="size-4 shrink-0 text-akosi-muted-fg" />
                              <p className="min-w-0 flex-1 truncate font-medium">{track.title}</p>
                              {track.locked ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-akosi-fg/15 text-akosi-muted-fg"
                                >
                                  <LockIcon className="size-3" />
                                  {track.cardCount} card{track.cardCount === 1 ? "" : "s"}
                                </Badge>
                              ) : null}
                              <span className="shrink-0 text-sm tabular-nums text-akosi-muted-fg">
                                {track.playCount} play{track.playCount === 1 ? "" : "s"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
