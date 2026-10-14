// Thin client for apps/api's public release/track routes
// (docs/11-mvp-phase0.md). credentials: "include" carries the fan
// unlock cookie (akosi_fan_unlock) across origins the same way
// lib/admin-api.ts carries the admin session cookie.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type MediaType = "AUDIO" | "VIDEO";

export type PublicTrack = {
  id: string;
  title: string;
  trackNumber: number | null;
  durationSec: number | null;
  mediaType: MediaType;
  lyrics: string | null;
  coverUrl: string | null;
};

export type PublicRelease = {
  id: string;
  title: string;
  artistName: string;
  releasedAt: string | null;
  coverUrl: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  locked: boolean;
  tracks?: PublicTrack[];
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

export function unlockRelease(id: string, password: string) {
  return request<PublicRelease>(`/releases/${id}/unlock`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function getTrackPlayUrl(id: string) {
  return request<PlayResponse>(`/tracks/${id}/play`);
}
