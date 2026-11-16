import { randomUUID } from "node:crypto";
import { hash } from "argon2";
import { prisma } from "@akosi/database";

// Shared DB fixtures for integration tests. Every fixture generates
// unique identifiers (email/slug/uid) so tests never collide with
// each other or with real dev-seeded data (e.g. the bootstrap "admin"
// account), and every create* has a matching delete* for afterEach
// cleanup — the dev Postgres volume is long-lived, not reset per run.

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@test.akosi.invalid`;
}

export async function createAdminUser(params: {
  email?: string;
  password: string;
  emailVerifiedAt?: Date | null;
  passwordSetAt?: Date | null;
  totpConfirmedAt?: Date | null;
}) {
  const passwordHash = await hash(params.password);
  return prisma.user.create({
    data: {
      email: params.email ?? uniqueEmail("admin"),
      role: "ADMIN",
      passwordHash,
      emailVerifiedAt: params.emailVerifiedAt ?? null,
      passwordSetAt: params.passwordSetAt ?? null,
      totpConfirmedAt: params.totpConfirmedAt ?? null,
    },
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await prisma.adminAuthChallenge.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

export async function createPrivateTrackWithCard(params: { cardUid: string; cardStatus?: "UNCLAIMED" | "CLAIMED" | "REVOKED" }) {
  const suffix = randomUUID();
  const artist = await prisma.artist.create({
    data: { name: `Test Artist ${suffix}`, slug: `test-artist-${suffix}` },
  });
  const release = await prisma.release.create({
    data: { artistId: artist.id, title: `Test Release ${suffix}`, visibility: "PRIVATE" },
  });
  const track = await prisma.track.create({
    data: { releaseId: release.id, title: `Test Track ${suffix}`, status: "READY" },
  });
  const card = await prisma.card.create({
    data: {
      uid: params.cardUid,
      artistId: artist.id,
      trackId: track.id,
      status: params.cardStatus ?? "UNCLAIMED",
    },
  });
  return { artist, release, track, card };
}

export async function deleteTrackFixture(fixture: {
  artist: { id: string };
  release: { id: string };
  track: { id: string };
  card: { id: string };
}): Promise<void> {
  await prisma.card.delete({ where: { id: fixture.card.id } }).catch(() => {});
  await prisma.track.delete({ where: { id: fixture.track.id } }).catch(() => {});
  await prisma.release.delete({ where: { id: fixture.release.id } }).catch(() => {});
  await prisma.artist.delete({ where: { id: fixture.artist.id } }).catch(() => {});
}
