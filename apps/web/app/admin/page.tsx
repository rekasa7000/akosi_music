"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as api from "@/lib/admin-api";
import { AkosiWordmark } from "@/components/admin/wordmark";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewArtistDialog } from "@/components/admin/catalog/new-artist-dialog";
import { NewReleaseDialog } from "@/components/admin/catalog/new-release-dialog";

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
      <header className="flex items-center justify-between border-b border-akosi-fg/10 px-6 py-4">
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
      <main className="mx-auto max-w-3xl space-y-12 px-6 py-16">
        <section>
          <div className="mb-4 flex items-center justify-between">
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
            <ul className="divide-y divide-akosi-fg/10 rounded-md border border-akosi-fg/10 bg-akosi-surface">
              {artists.map((artist) => (
                <li key={artist.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium">{artist.name}</p>
                    <p className="text-sm text-akosi-muted-fg">{artist.slug}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
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
            <ul className="divide-y divide-akosi-fg/10 rounded-md border border-akosi-fg/10 bg-akosi-surface">
              {releases.map((release) => (
                <li key={release.id}>
                  <Link
                    href={`/admin/releases/${release.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-akosi-fg/5"
                  >
                    <div>
                      <p className="font-medium">{release.title}</p>
                      <p className="text-sm text-akosi-muted-fg">{artistName(release.artistId)}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-akosi-fg/15 text-akosi-muted-fg"
                    >
                      {release.visibility}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
