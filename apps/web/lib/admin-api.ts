// Thin client for apps/api's admin-auth routes
// (docs/12-admin-authentication.md). The API runs on its own origin —
// every call needs credentials: "include" so the session cookie
// actually gets sent/stored cross-origin.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Step =
  | "SET_EMAIL"
  | "EMAIL_VERIFICATION"
  | "PASSWORD_SETUP"
  | "TOTP_ENROLLMENT"
  | "SELECT_MFA_METHOD"
  | "ENTER_CODE"
  | "DONE";

export type ChallengeResponse = {
  step: Step;
  challengeToken?: string;
  qrCodeDataUrl?: string;
  manualEntryKey?: string;
  availableMethods?: string[];
};

export class AdminApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    // Only set Content-Type when there's actually a body — Fastify's
    // JSON body parser rejects "Content-Type: application/json" paired
    // with an empty body (400), which bodyless POSTs like /admin/logout
    // would otherwise hit every time.
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // A 401 on anything but the login/me routes means a previously
    // valid session died (expiry, logout elsewhere) mid-use — send the
    // admin back to re-authenticate rather than show a dead-end error.
    if (res.status === 401 && path !== "/admin/login" && path !== "/admin/me") {
      if (typeof window !== "undefined" && window.location.pathname !== "/admin/login") {
        window.location.href = "/admin/login";
      }
    }
    throw new AdminApiError(body?.error ?? "Something went wrong.");
  }
  return body as T;
}

export function login(email: string, password: string) {
  return request<ChallengeResponse>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function setupEmail(challengeToken: string, email: string) {
  return request<ChallengeResponse>("/admin/setup/email", {
    method: "POST",
    body: JSON.stringify({ challengeToken, email }),
  });
}

export function verifyEmail(challengeToken: string, code: string) {
  return request<ChallengeResponse>("/admin/verify-email", {
    method: "POST",
    body: JSON.stringify({ challengeToken, code }),
  });
}

export function setupPassword(challengeToken: string, password: string) {
  return request<ChallengeResponse>("/admin/setup/password", {
    method: "POST",
    body: JSON.stringify({ challengeToken, password }),
  });
}

export function confirmTotp(challengeToken: string, code: string) {
  return request<ChallengeResponse>("/admin/totp/confirm", {
    method: "POST",
    body: JSON.stringify({ challengeToken, code }),
  });
}

export function selectLoginMethod(challengeToken: string, method: "EMAIL" | "TOTP") {
  return request<ChallengeResponse>("/admin/login/method", {
    method: "POST",
    body: JSON.stringify({ challengeToken, method }),
  });
}

export function verifyLogin(challengeToken: string, code: string) {
  return request<ChallengeResponse>("/admin/login/verify", {
    method: "POST",
    body: JSON.stringify({ challengeToken, code }),
  });
}

export function logout() {
  return request<ChallengeResponse>("/admin/logout", { method: "POST" });
}

export function me() {
  return request<{ email: string; role: string }>("/admin/me");
}

// --- Catalog (artists / releases / tracks / media) ---
// docs/11-mvp-phase0.md — mirrors apps/api's admin-artists/releases/tracks/media routes.

export type Artist = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  createdAt: string;
};

export type MediaType = "AUDIO" | "VIDEO";

export type TrackSummary = {
  id: string;
  title: string;
  trackNumber: number | null;
  mediaType: MediaType;
  status: string;
  coverImageKey: string | null;
  // "locked" means the track has ever had a card assigned, even if
  // every one is currently revoked (still gated, just needs a new
  // card to be redeemable again) — cardCount only counts active ones.
  cardCount: number;
  locked: boolean;
};

export type Release = {
  id: string;
  artistId: string;
  title: string;
  releasedAt: string | null;
  coverImageKey: string | null;
  createdAt: string;
};

export type ReleaseWithTracks = Release & { tracks: TrackSummary[] };

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

export type MediaUploadPurpose =
  | "release-cover"
  | "track-cover"
  | "track-audio"
  | "track-video"
  | "artist-profile"
  | "artist-cover";

export type ArtistWithCounts = Artist & { releaseCount: number; trackCount: number };

export function listArtists() {
  return request<ArtistWithCounts[]>("/admin/artists");
}

export function createArtist(params: { name: string; slug: string; bio?: string }) {
  return request<Artist>("/admin/artists", { method: "POST", body: JSON.stringify(params) });
}

export type ReleaseSummary = Release & { artistName: string; coverUrl: string | null; trackCount: number };

export function listReleases() {
  return request<ReleaseSummary[]>("/admin/releases");
}

export function getRelease(id: string) {
  return request<ReleaseWithTracks>(`/admin/releases/${encodeURIComponent(id)}`);
}

export function createRelease(params: { artistId: string; title: string; releasedAt?: string }) {
  return request<Release>("/admin/releases", { method: "POST", body: JSON.stringify(params) });
}

export function updateRelease(
  id: string,
  params: { title?: string; releasedAt?: string; coverImageKey?: string },
) {
  return request<Release>(`/admin/releases/${encodeURIComponent(id)}`, {
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
  return request<Track>(`/admin/releases/${encodeURIComponent(releaseId)}/tracks`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export type TrackPickerEntry = {
  id: string;
  title: string;
  releaseTitle: string;
  artistName: string;
  mediaType: MediaType;
};

export function listAllTracks() {
  return request<TrackPickerEntry[]>("/admin/tracks");
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
  return request<PlayResponse>(`/admin/tracks/${encodeURIComponent(id)}/play`);
}

export function updateTrack(
  id: string,
  params: { title?: string; trackNumber?: number; lyrics?: string; coverImageKey?: string },
) {
  return request<Track>(`/admin/tracks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

function presignMedia(purpose: MediaUploadPurpose, contentType: string) {
  return request<{ key: string; uploadUrl: string }>("/admin/media/presign", {
    method: "POST",
    body: JSON.stringify({ purpose, contentType }),
  });
}

// Presigns then PUTs directly to the storage bucket — the file itself
// never passes through this app's own server, only through the browser.
export async function uploadMedia(purpose: MediaUploadPurpose, file: File): Promise<string> {
  const { key, uploadUrl } = await presignMedia(purpose, file.type);
  const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!res.ok) {
    throw new AdminApiError("Upload failed. Please try again.");
  }
  return key;
}

// --- Dashboard stats ---

export type Stats = {
  artistCount: number;
  releaseCount: number;
  trackCount: number;
  totalPlays: number;
  cardCount: number;
  cardsByStatus: { UNCLAIMED: number; CLAIMED: number; REVOKED: number };
};

export function getStats() {
  return request<Stats>("/admin/stats");
}

// --- Artist detail (roster drill-down) ---

export type ArtistTrack = {
  id: string;
  title: string;
  trackNumber: number | null;
  mediaType: MediaType;
  status: string;
  playCount: number;
  cardCount: number;
  locked: boolean;
};

export type ArtistReleaseSummary = {
  id: string;
  title: string;
  releasedAt: string | null;
  tracks: ArtistTrack[];
};

export type ArtistDetail = Artist & {
  totalPlays: number;
  releaseCount: number;
  trackCount: number;
  releases: ArtistReleaseSummary[];
};

export function getArtist(id: string) {
  return request<ArtistDetail>(`/admin/artists/${encodeURIComponent(id)}`);
}

export function updateArtist(
  id: string,
  params: {
    bio?: string;
    websiteUrl?: string | null;
    instagramUrl?: string | null;
    twitterUrl?: string | null;
    profileImageKey?: string;
    coverImageKey?: string;
  },
) {
  return request<Artist>(`/admin/artists/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

// --- Cards (Phase 0.5 manual provisioning, docs/11-mvp-phase0.md) ---

export type CardStatus = "UNCLAIMED" | "CLAIMED" | "REVOKED";

export type Card = {
  id: string;
  uid: string;
  status: CardStatus;
  editionLabel: string | null;
  provisionedAt: string;
  trackId: string;
  trackTitle: string;
  releaseId: string;
  releaseTitle: string;
  artistId: string;
  artistName: string;
  playCount: number;
};

export function listCards() {
  return request<Card[]>("/admin/cards");
}

export function createCard(params: { uid: string; trackId: string; editionLabel?: string }) {
  return request<Card>("/admin/cards", { method: "POST", body: JSON.stringify(params) });
}

export function updateCard(id: string, params: { status?: CardStatus; editionLabel?: string }) {
  return request<Card>(`/admin/cards/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}
