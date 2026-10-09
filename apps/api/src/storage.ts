import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
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
    ...(endpoint && { endpoint, forcePathStyle: true }),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "akosi",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "akosi-dev-secret",
    },
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

export async function createPresignedUploadUrl(params: {
  bucket: string;
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string> {
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
  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: params.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS,
  });
}
