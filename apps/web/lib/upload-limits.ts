// Mirrors the server-side defaults in apps/api/src/storage.ts
// (MAX_UPLOAD_BYTES). This is a fast-feedback convenience only — the
// server re-checks the real uploaded file size via HeadObject before
// promoting it, since a client can't be trusted to report its own
// file size honestly.
export const MAX_AUDIO_UPLOAD_MB = 50;
export const MAX_VIDEO_UPLOAD_MB = 200;
export const MAX_IMAGE_UPLOAD_MB = 10;

export function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
