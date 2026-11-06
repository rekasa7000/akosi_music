// Thin client for apps/api's artist-auth/artist-releases/artist-tracks/
// artist-media routes. Deliberately separate from admin-api.ts — different
// cookie (akosi_artist_session vs akosi_admin_session), different 401
// redirect target, different error class — so the two can never be
// accidentally cross-wired.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ArtistApiError extends Error {}

// Routes where a 401 is an expected, inline-handleable outcome (a bad
// password), not "the session died" — these must NOT trigger the global
// redirect-to-login side effect.
const NO_REDIRECT_PATHS = new Set(["/artist/login", "/artist/me", "/artist/setup/password"]);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !NO_REDIRECT_PATHS.has(path)) {
      if (typeof window !== "undefined" && window.location.pathname !== "/artist/login") {
        window.location.href = "/artist/login";
      }
    }
    throw new ArtistApiError(body?.error ?? "Something went wrong.");
  }
  return body as T;
}

export type LoginStep = "PASSWORD_SETUP" | "DONE";

export function login(email: string, password: string) {
  return request<{ step: LoginStep }>("/artist/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function setupPassword(email: string, currentPassword: string, newPassword: string) {
  return request<{ step: LoginStep }>("/artist/setup/password", {
    method: "POST",
    body: JSON.stringify({ email, currentPassword, newPassword }),
  });
}

export function logout() {
  return request<{ ok: true }>("/artist/logout", { method: "POST" });
}

export type Me = { email: string; artistId: string; artistName: string; passwordSetAt: string | null };

export function me() {
  return request<Me>("/artist/me");
}

// --- Catalog (own releases/tracks only — scoped server-side) ---

export type MediaType = "AUDIO" | "VIDEO";

export type Track = {
  id: string;
  releaseId: string;
  title: string;
  trackNumber: number | null;
  durationSec: number | null;
  mediaType: MediaType;
  lyrics: string | null;
  coverImageKey: string | null;
  status: string;
  createdAt: string;
};

export type TrackSummary = {
  id: string;
  title: string;
  trackNumber: number | null;
  mediaType: MediaType;
  status: string;
  lyrics: string | null;
  coverImageKey: string | null;
};

export type Release = {
  id: string;
  title: string;
  releasedAt: string | null;
  coverImageKey: string | null;
  createdAt: string;
};

export type ReleaseWithTracks = Release & { tracks: TrackSummary[] };
export type ReleaseSummary = Release & { coverUrl: string | null; trackCount: number };

export function listReleases() {
  return request<ReleaseSummary[]>("/artist/releases");
}

export function createRelease(params: { title: string; releasedAt?: string }) {
  return request<Release>("/artist/releases", { method: "POST", body: JSON.stringify(params) });
}

export function getRelease(id: string) {
  return request<ReleaseWithTracks>(`/artist/releases/${encodeURIComponent(id)}`);
}

export function updateRelease(id: string, params: { title?: string; releasedAt?: string; coverImageKey?: string }) {
  return request<Release>(`/artist/releases/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

export function createTrack(
  releaseId: string,
  params: {
    title: string;
    mediaType: MediaType;
    rawStorageKey: string;
    trackNumber?: number;
    durationSec?: number;
    lyrics?: string;
    coverImageKey?: string;
  },
) {
  return request<Track>(`/artist/releases/${encodeURIComponent(releaseId)}/tracks`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function updateTrack(
  id: string,
  params: { title?: string; trackNumber?: number; lyrics?: string; coverImageKey?: string },
) {
  return request<Track>(`/artist/tracks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

export type PlayResponse = {
  url: string;
  mediaType: MediaType;
  title: string;
  artistName: string;
  releaseTitle: string;
  coverUrl: string | null;
  lyrics: string | null;
};

export function getTrackPlayUrl(id: string) {
  return request<PlayResponse>(`/artist/tracks/${encodeURIComponent(id)}/play`);
}

// --- Media uploads (presign then direct PUT, same pattern as admin-api.ts) ---

export type MediaUploadPurpose = "release-cover" | "track-cover" | "track-audio" | "track-video";

function presignMedia(purpose: MediaUploadPurpose, contentType: string) {
  return request<{ key: string; uploadUrl: string }>("/artist/media/presign", {
    method: "POST",
    body: JSON.stringify({ purpose, contentType }),
  });
}

export async function uploadMedia(purpose: MediaUploadPurpose, file: File): Promise<string> {
  const { key, uploadUrl } = await presignMedia(purpose, file.type);
  const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!res.ok) {
    throw new ArtistApiError("Upload failed. Please try again.");
  }
  return key;
}
