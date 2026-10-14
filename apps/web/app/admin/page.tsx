"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MusicIcon } from "lucide-react";
import * as api from "@/lib/admin-api";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewArtistDialog } from "@/components/admin/catalog/new-artist-dialog";
import { NewReleaseDialog } from "@/components/admin/catalog/new-release-dialog";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [artists, setArtists] = useState<api.Artist[] | null>(null);
  const [releases, setReleases] = useState<api.Release[] | null>(null);

  useEffect(() => {
    api
      .me()
      .then((user) => setEmail(user.email))
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  useEffect(() => {
    if (!email) return;
    api.listArtists().then(setArtists);
    api.listReleases().then(setReleases);
  }, [email]);

  async function signOut() {
    await api.logout().catch(() => {});
    router.replace("/admin/login");
  }

  if (!email) {
    return null;
  }

  const artistName = (artistId: string) =>
    artists?.find((a) => a.id === artistId)?.name ?? "Unknown artist";

  return (
    <div className="min-h-dvh bg-akosi-bg font-sans text-akosi-fg">
      <header className="flex items-center justify-between border-b border-akosi-fg/10 px-6 py-4 lg:px-10">
        <AkosiWordmark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            className="border-akosi-fg/15 bg-transparent! text-akosi-fg! hover:bg-akosi-fg/10!"
            onClick={signOut}
          >
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-14 px-6 py-12 lg:px-10">
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-lg font-medium">Artists</h2>
            {artists ? (
              <NewArtistDialog onCreated={(artist) => setArtists([artist, ...artists])} />
            ) : null}
          </div>
          {artists === null ? (
            <p className="text-sm text-akosi-muted-fg">Loading…</p>
          ) : artists.length === 0 ? (
            <p className="text-sm text-akosi-muted-fg">No artists yet — add one to get started.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {artists.map((artist) => (
                <div
                  key={artist.id}
                  className="flex items-center gap-3 rounded-full border border-akosi-fg/10 bg-akosi-surface py-1.5 pl-1.5 pr-4"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-akosi-accent to-akosi-accent-2 text-xs font-medium text-white">
                    {initials(artist.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">{artist.name}</p>
                    <p className="text-xs leading-tight text-akosi-muted-fg">{artist.slug}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-lg font-medium">Releases</h2>
            {artists && releases ? (
              <NewReleaseDialog
                artists={artists}
                onCreated={(release) => setReleases([release, ...releases])}
              />
            ) : null}
          </div>
          {releases === null ? (
            <p className="text-sm text-akosi-muted-fg">Loading…</p>
          ) : releases.length === 0 ? (
            <p className="text-sm text-akosi-muted-fg">
              No releases yet{artists?.length === 0 ? " — add an artist first." : "."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {releases.map((release) => (
                <Link
                  key={release.id}
                  href={`/admin/releases/${release.id}`}
                  className="group rounded-lg p-3 transition-colors hover:bg-akosi-fg/5"
                >
                  <div className="relative mb-3 aspect-square overflow-hidden rounded-md bg-linear-to-br from-akosi-accent/20 to-akosi-accent-2/20 shadow-sm">
                    <div className="flex size-full items-center justify-center text-akosi-muted-fg/60">
                      <MusicIcon className="size-8" strokeWidth={1.5} />
                    </div>
                    <Badge
                      variant="outline"
                      className="absolute top-2 right-2 border-black/10 bg-black/60 text-[10px] text-white backdrop-blur-sm"
                    >
                      {release.visibility}
                    </Badge>
                  </div>
                  <p className="truncate font-medium">{release.title}</p>
                  <p className="truncate text-sm text-akosi-muted-fg">{artistName(release.artistId)}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
