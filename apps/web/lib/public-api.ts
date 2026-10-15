// Thin client for apps/api's public release/track/card routes
// (docs/11-mvp-phase0.md). credentials: "include" carries the fan
// unlock cookie (akosi_fan_unlock) across origins the same way
// lib/admin-api.ts carries the admin session cookie.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type MediaType = "AUDIO" | "VIDEO";

// Locked tracks only ever carry id/title/trackNumber/mediaType/locked
// — no lyrics, no cover, nothing else until a valid card is redeemed
// for that specific track.
export type PublicTrack = {
  id: string;
  title: string;
  trackNumber: number | null;
  durationSec: number | null;
  mediaType: MediaType;
  locked: boolean;
  lyrics: string | null;
  coverUrl: string | null;
};

export type PublicRelease = {
  id: string;
  title: string;
  artistName: string;
  releasedAt: string | null;
  coverUrl: string | null;
  tracks: PublicTrack[];
};

export type RedeemedTrack = {
  id: string;
  title: string;
  trackNumber: number | null;
  durationSec: number | null;
  mediaType: MediaType;
  lyrics: string | null;
  coverUrl: string | null;
  releaseId: string;
  releaseTitle: string;
  artistName: string;
};

export type PlayResponse = { url: string; mediaType: MediaType };

export class PublicApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new PublicApiError(body?.error ?? "Something went wrong.");
  }
  return body as T;
}

export function getRelease(id: string) {
  return request<PublicRelease>(`/releases/${id}`);
}

// Redeeming a card is how a track goes from locked to playable — via
// the code baked into an NFC tap URL, or typed in by hand after
// finding a track locked while browsing.
export function redeemCard(uid: string) {
  return request<RedeemedTrack>("/cards/redeem", { method: "POST", body: JSON.stringify({ uid }) });
}

export function getTrackPlayUrl(id: string) {
  return request<PlayResponse>(`/tracks/${id}/play`);
}
