import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Talks to the real AWS S3 API — against LocalStack in dev (S3_ENDPOINT
// set, path-style addressing) and against real AWS in prod (S3_ENDPOINT
// unset). Per docs/04-tech-stack.md, this is the one place that knows
// about the storage provider's SDK — nothing else in the app should
// import @aws-sdk/* directly.

export const RAW_BUCKET = process.env.S3_BUCKET_RAW ?? "akosi-raw";
export const MEDIA_BUCKET = process.env.S3_BUCKET_MEDIA ?? "akosi-media";

function createS3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  return new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    // Dev-only override block: point at LocalStack with its throwaway
    // credentials. In a real deployment S3_ENDPOINT is unset, so this
    // entire block — including the credential fallbacks — is never
    // constructed; the SDK's default provider chain (IAM role, etc.)
    // takes over instead. Previously the credentials fallback was
    // unconditional, which is a hardcoded-default-credential pattern
    // (CWE-798/1188) even though the fallback values were never real
    // AWS keys — flagged by security review.
    ...(endpoint && {
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "akosi",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "akosi-dev-secret",
      },
    }),
    // Without this, the SDK attaches an x-amz-checksum-crc32 query
    // param to presigned URLs computed from an empty body (since the
    // real body isn't known at presign time) — any real upload body
    // then fails checksum validation on PUT.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

let s3: S3Client | undefined;

function getS3Client(): S3Client {
  s3 ??= createS3Client();
  return s3;
}

const DEFAULT_EXPIRY_SECONDS = 10 * 60;
const KNOWN_BUCKETS = new Set([RAW_BUCKET, MEDIA_BUCKET]);

// Defense in depth: callers already constrain `bucket` before reaching
// here, but this adapter is meant to be the one place in the app that
// talks to S3 directly — it shouldn't rely solely on every future
// caller remembering to constrain it too.
function assertKnownBucket(bucket: string): void {
  if (!KNOWN_BUCKETS.has(bucket)) {
    throw new Error(`Refusing to operate on unrecognized bucket: ${bucket}`);
  }
}

export async function createPresignedUploadUrl(params: {
  bucket: string;
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  assertKnownBucket(params.bucket);
  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    ContentType: params.contentType,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: params.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS,
  });
}

export async function createPresignedPlaybackUrl(params: {
  bucket: string;
  key: string;
  expiresInSeconds?: number;
}): Promise<string> {
  assertKnownBucket(params.bucket);
  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: params.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS,
  });
}

// --- Admin catalog uploads (artists/releases/tracks) ---
//
// Flow: admin requests a presigned PUT for a server-generated key
// (generateUploadKey), uploads the file directly to the raw bucket,
// then confirms it when creating/updating the Track or Release row.
// Confirmation calls promoteRawUploadToMedia, which verifies the
// object actually landed (HeadObject — a client that never finishes
// the PUT shouldn't be able to register a phantom file) and copies it
// into the media bucket, which is what signed playback/display URLs
// are minted against.
//
// Phase 0 has no transcode worker yet (apps/worker is still a
// placeholder), so this copy stands in for real processing — see
// docs/11-mvp-phase0.md. When the worker exists, it takes over this
// step instead of a same-process copy.

export type MediaUploadPurpose =
  | "release-cover"
  | "track-cover"
  | "track-audio"
  | "track-video"
  | "artist-profile"
  | "artist-cover";

export function generateUploadKey(purpose: MediaUploadPurpose): string {
  return `raw/${purpose}/${randomUUID()}`;
}

// A key an admin echoes back when confirming an upload should still
// carry the purpose prefix we generated it with — catches a stray or
// mistyped key before it ever reaches S3, on top of the existence
// check below.
export function keyMatchesPurpose(key: string, purpose: MediaUploadPurpose): boolean {
  return key.startsWith(`raw/${purpose}/`);
}

export class UploadNotFoundError extends Error {}

async function assertRawUploadExists(key: string): Promise<void> {
  try {
    await getS3Client().send(new HeadObjectCommand({ Bucket: RAW_BUCKET, Key: key }));
  } catch {
    throw new UploadNotFoundError(
      `No upload found at "${key}" — presign and upload the file before confirming it.`,
    );
  }
}

export async function promoteRawUploadToMedia(key: string): Promise<void> {
  await assertRawUploadExists(key);
  await getS3Client().send(
    new CopyObjectCommand({
      Bucket: MEDIA_BUCKET,
      CopySource: `${RAW_BUCKET}/${encodeURIComponent(key)}`,
      Key: key,
    }),
  );
}
