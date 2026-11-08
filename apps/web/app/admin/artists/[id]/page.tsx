"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeftIcon,
  DiscIcon,
  Loader2Icon,
  LockIcon,
  Music2Icon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/admin-api";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CoverUploader } from "@/components/admin/catalog/cover-uploader";
import { TrackPlayer } from "@/components/admin/track-player";
import { LifecycleMenu } from "@/components/admin/catalog/lifecycle-actions";
import { cn } from "@/lib/utils";

function StatChip({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-akosi-muted-fg">
      <Icon className="size-3.5" />
      <span className="font-medium text-akosi-fg">{value}</span>
      {label}
    </div>
  );
}

function LinkField({
  id,
  label,
  defaultValue,
  onSave,
}: {
  id: string;
  label: string;
  defaultValue: string | null;
  onSave: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        ref={ref}
        type="url"
        defaultValue={defaultValue ?? ""}
        placeholder="https://…"
        onBlur={() => onSave(ref.current?.value.trim() ?? "")}
        className="text-sm"
      />
    </div>
  );
}

const ACCOUNT_STATUS_LABEL: Record<api.ArtistAccountStatus, string> = {
  NONE: "Not invited",
  PENDING: "Invite pending",
  ACTIVE: "Active",
};

// One backend action (POST /admin/artists/:id/invite) covers invite,
// resend, and portal-password-reset — this panel just picks the label
// based on the artist's current accountStatus.
function PortalAccessPanel({
  artist,
  onInvited,
}: {
  artist: api.ArtistDetail;
  onInvited: (patch: { accountStatus: api.ArtistAccountStatus; accountEmail: string }) => void;
}) {
  const [email, setEmail] = useState(artist.accountEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const actionLabel =
    artist.accountStatus === "NONE"
      ? "Send invite"
      : artist.accountStatus === "PENDING"
        ? "Resend invite"
        : "Reset portal password";

  async function handleInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setError(null);
    setSent(false);
    setBusy(true);
    try {
      await api.inviteArtist(artist.id, trimmed);
      onInvited({
        accountStatus: artist.accountStatus === "NONE" ? "PENDING" : artist.accountStatus,
        accountEmail: trimmed,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof api.AdminApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-akosi-fg/10 bg-akosi-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium tracking-wide text-akosi-muted-fg uppercase">Portal access</p>
        <Badge variant="outline" className="border-akosi-fg/15 text-akosi-muted-fg">
          {ACCOUNT_STATUS_LABEL[artist.accountStatus]}
        </Badge>
      </div>
      <form onSubmit={handleInvite} className="space-y-2">
        <Label htmlFor="artist-portal-email" className="sr-only">
          Artist email
        </Label>
        <Input
          id="artist-portal-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="artist@email.com"
          className="text-sm"
        />
        {error ? <p className="text-xs text-akosi-accent-2">{error}</p> : null}
        {sent && !error ? <p className="text-xs text-akosi-muted-fg">Invite sent.</p> : null}
        <Button
          type="submit"
          disabled={busy}
          className="w-full bg-akosi-accent! text-white! hover:bg-akosi-accent-2! disabled:opacity-60"
        >
          {busy ? "Sending…" : actionLabel}
        </Button>
      </form>
    </div>
  );
}

export default function ArtistDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [artist, setArtist] = useState<api.ArtistDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const [bioDirty, setBioDirty] = useState(false);
  const [playing, setPlaying] = useState<api.PlayResponse & { trackId: string }>();
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);

  useEffect(() => {
    api.getArtist(params.id).then(setArtist).catch(() => setNotFound(true));
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

  function patchArtist(params: Parameters<typeof api.updateArtist>[1]) {
    if (!artist) return;
    api.updateArtist(artist.id, params).then((updated) => setArtist({ ...artist, ...updated }));
  }

  async function saveBio() {
    if (!artist) return;
    const bio = bioRef.current?.value.trim() ?? "";
    if (bio === (artist.bio ?? "")) {
      setBioDirty(false);
      return;
    }
    patchArtist({ bio });
    setBioDirty(false);
  }

  return (
    <AdminShell>
      {notFound ? (
        <p className="p-8 text-sm text-akosi-muted-fg">Artist not found.</p>
      ) : !artist ? (
        <p className="p-8 text-sm text-akosi-muted-fg">Loading…</p>
      ) : (
        <div className="px-8 py-10">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/admin/artists"
              className="inline-flex items-center gap-1.5 text-sm text-akosi-muted-fg transition-colors hover:text-akosi-fg"
            >
              <ArrowLeftIcon className="size-3.5" />
              Back to artists
            </Link>
            <LifecycleMenu
              deletedAt={artist.deletedAt}
              itemLabel="artist"
              getCascadeCounts={() => api.getArtistCascadeCounts(artist.id)}
              onArchive={async () => {
                // Archiving cascades to this artist's releases/tracks
                // (and revokes their cards) — refetch rather than
                // merge so the nested lists reflect that too.
                await api.archiveArtist(artist.id);
                setArtist(await api.getArtist(artist.id));
              }}
              onRestore={async () => {
                await api.restoreArtist(artist.id);
                setArtist(await api.getArtist(artist.id));
              }}
              onDeletePermanently={async () => {
                await api.deleteArtistPermanently(artist.id);
                router.push("/admin/artists");
              }}
            />
          </div>

          {artist.deletedAt ? (
            <p className="mb-6 rounded-xl border border-akosi-accent-2/30 bg-akosi-accent-2/10 px-4 py-2.5 text-sm text-akosi-accent-2">
              This artist is archived — hidden from fans until restored.
            </p>
          ) : null}

          <CoverUploader
            purpose="artist-cover"
            aspect="banner"
            uploadMedia={api.uploadMedia}
            currentUrl={artist.coverImageUrl}
            onUploaded={async (coverImageKey) => {
              const updated = await api.updateArtist(artist.id, { coverImageKey });
              setArtist({ ...artist, ...updated });
            }}
          />

          <div className="relative z-10 -mt-12 w-28 rounded-full ring-4 ring-akosi-bg">
            <CoverUploader
              purpose="artist-profile"
              shape="circle"
              size="xs"
              uploadMedia={api.uploadMedia}
              currentUrl={artist.profileImageUrl}
              onUploaded={async (profileImageKey) => {
                const updated = await api.updateArtist(artist.id, { profileImageKey });
                setArtist({ ...artist, ...updated });
              }}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_20rem]">
            <div className="max-w-2xl">
              <h1 className="font-display text-3xl font-semibold">{artist.name}</h1>
              <p className="mt-1 text-sm text-akosi-muted-fg">{artist.slug}</p>

              <div className="mt-4 flex flex-wrap gap-5">
                <StatChip icon={PlayIcon} value={artist.totalPlays} label="plays" />
                <StatChip icon={DiscIcon} value={artist.releaseCount} label="releases" />
                <StatChip icon={Music2Icon} value={artist.trackCount} label="tracks" />
              </div>

              <div className="mt-6 space-y-1.5">
                <Label htmlFor="artist-bio">Bio</Label>
                <Textarea
                  id="artist-bio"
                  ref={bioRef}
                  defaultValue={artist.bio ?? ""}
                  onChange={() => setBioDirty(true)}
                  onBlur={saveBio}
                  placeholder="Tell fans about this artist…"
                  rows={4}
                />
                {bioDirty ? <p className="text-xs text-akosi-muted-fg">Click away to save</p> : null}
              </div>
            </div>

            <div className="space-y-4">
              <PortalAccessPanel
                artist={artist}
                onInvited={(patch) => setArtist({ ...artist, ...patch })}
              />
              <div className="space-y-4 rounded-xl border border-akosi-fg/10 bg-akosi-surface p-5">
                <p className="text-sm font-medium tracking-wide text-akosi-muted-fg uppercase">Links</p>
                <LinkField
                  id="artist-website"
                  label="Website"
                  defaultValue={artist.websiteUrl}
                  onSave={(websiteUrl) => patchArtist({ websiteUrl: websiteUrl || null })}
                />
                <LinkField
                  id="artist-instagram"
                  label="Instagram"
                  defaultValue={artist.instagramUrl}
                  onSave={(instagramUrl) => patchArtist({ instagramUrl: instagramUrl || null })}
                />
                <LinkField
                  id="artist-twitter"
                  label="Twitter / X"
                  defaultValue={artist.twitterUrl}
                  onSave={(twitterUrl) => patchArtist({ twitterUrl: twitterUrl || null })}
                />
                <LinkField
                  id="artist-facebook"
                  label="Facebook"
                  defaultValue={artist.facebookUrl}
                  onSave={(facebookUrl) => patchArtist({ facebookUrl: facebookUrl || null })}
                />
                <LinkField
                  id="artist-spotify"
                  label="Spotify"
                  defaultValue={artist.spotifyUrl}
                  onSave={(spotifyUrl) => patchArtist({ spotifyUrl: spotifyUrl || null })}
                />
              </div>
            </div>
          </div>

          <div className="mt-12 space-y-8">
            {artist.releases.length === 0 ? (
              <p className="text-sm text-akosi-muted-fg">No releases yet.</p>
            ) : (
              artist.releases.map((release) => (
                <section key={release.id}>
                  <div className="mb-3 flex items-center gap-2">
                    <Link
                      href={`/admin/releases/${release.id}`}
                      className={cn(
                        "inline-block font-display text-lg font-medium hover:underline",
                        release.deletedAt && "text-akosi-muted-fg",
                      )}
                    >
                      {release.title}
                    </Link>
                    {release.deletedAt ? (
                      <Badge variant="outline" className="border-akosi-accent-2/30 text-akosi-accent-2">
                        Archived
                      </Badge>
                    ) : null}
                  </div>
                  {release.tracks.length === 0 ? (
                    <p className="text-sm text-akosi-muted-fg">No tracks yet.</p>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-akosi-fg/10 bg-akosi-surface">
                      {release.tracks.map((track, i) => {
                        const isPlaying = playing?.trackId === track.id;
                        const isLoading = loadingTrackId === track.id;
                        return (
                          <div
                            key={track.id}
                            className={cn(
                              "flex items-center gap-4 px-5 py-3",
                              i !== 0 && "border-t border-akosi-fg/10",
                              track.deletedAt && "opacity-60",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => handlePlay(track)}
                              disabled={isLoading}
                              className={cn(
                                "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                                isPlaying
                                  ? "bg-akosi-accent text-white"
                                  : "bg-akosi-accent/10 text-akosi-accent-2 hover:bg-akosi-accent/20",
                              )}
                            >
                              {isLoading ? (
                                <Loader2Icon className="size-3.5 animate-spin" />
                              ) : isPlaying ? (
                                <PauseIcon className="size-3.5" />
                              ) : (
                                <PlayIcon className="size-3.5" />
                              )}
                            </button>
                            <p className="min-w-0 flex-1 truncate font-medium">{track.title}</p>
                            {track.deletedAt ? (
                              <Badge variant="outline" className="border-akosi-accent-2/30 text-akosi-accent-2">
                                Archived
                              </Badge>
                            ) : null}
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
        </div>
      )}
      {playing ? (
        <TrackPlayer key={playing.trackId} playback={playing} onClose={() => setPlaying(undefined)} />
      ) : null}
    </AdminShell>
  );
}
