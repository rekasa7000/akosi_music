import { prisma } from "@akosi/database";

// Soft-delete ("archive") + permanent delete for the catalog hierarchy
// (Artist -> Release -> Track -> Card). Archiving cascades down (hides
// everything under the archived row and revokes its cards); restoring
// only clears the row's own deletedAt — the admin restores each level
// they actually want back, rather than archive silently reviving a
// whole subtree. Permanent delete requires the row already be
// archived (Artist/Release/Track) or revoked (Card) first — a
// deliberate two-step gate, not just a convenience check — and then
// hard-deletes bottom-up in a transaction so FK constraints never
// block it.

export class NotFoundError extends Error {}
export class NotArchivedError extends Error {}

type CascadeCounts = { releases: number; tracks: number; cards: number };

// --- Artist ---

export async function archiveArtist(id: string) {
  return prisma.$transaction(async (tx) => {
    const artist = await tx.artist.findUnique({ where: { id } });
    if (!artist) throw new NotFoundError("Artist not found.");

    const now = new Date();
    const releases = await tx.release.findMany({ where: { artistId: id }, select: { id: true } });
    const releaseIds = releases.map((r) => r.id);
    const trackIds = (
      await tx.track.findMany({ where: { releaseId: { in: releaseIds } }, select: { id: true } })
    ).map((t) => t.id);

    await tx.release.updateMany({ where: { id: { in: releaseIds }, deletedAt: null }, data: { deletedAt: now } });
    await tx.track.updateMany({ where: { id: { in: trackIds }, deletedAt: null }, data: { deletedAt: now } });
    await tx.card.updateMany({ where: { artistId: id, status: { not: "REVOKED" } }, data: { status: "REVOKED" } });

    return tx.artist.update({ where: { id }, data: { deletedAt: now } });
  });
}

export async function restoreArtist(id: string) {
  const artist = await prisma.artist.findUnique({ where: { id } });
  if (!artist) throw new NotFoundError("Artist not found.");
  return prisma.artist.update({ where: { id }, data: { deletedAt: null } });
}

export async function artistCascadeCounts(id: string): Promise<CascadeCounts> {
  const releases = await prisma.release.findMany({ where: { artistId: id }, select: { id: true } });
  const releaseIds = releases.map((r) => r.id);
  const [tracks, cards] = await Promise.all([
    prisma.track.count({ where: { releaseId: { in: releaseIds } } }),
    prisma.card.count({ where: { artistId: id } }),
  ]);
  return { releases: releaseIds.length, tracks, cards };
}

export async function deleteArtistPermanently(id: string) {
  return prisma.$transaction(async (tx) => {
    const artist = await tx.artist.findUnique({ where: { id } });
    if (!artist) throw new NotFoundError("Artist not found.");
    if (!artist.deletedAt) throw new NotArchivedError("Archive the artist before deleting it permanently.");

    const releaseIds = (await tx.release.findMany({ where: { artistId: id }, select: { id: true } })).map(
      (r) => r.id,
    );
    const trackIds = (
      await tx.track.findMany({ where: { releaseId: { in: releaseIds } }, select: { id: true } })
    ).map((t) => t.id);
    const cardIds = (await tx.card.findMany({ where: { artistId: id }, select: { id: true } })).map((c) => c.id);

    await tx.playEvent.deleteMany({ where: { OR: [{ trackId: { in: trackIds } }, { cardId: { in: cardIds } }] } });
    await tx.cardOwnership.deleteMany({ where: { cardId: { in: cardIds } } });
    await tx.card.deleteMany({ where: { id: { in: cardIds } } });
    await tx.track.deleteMany({ where: { id: { in: trackIds } } });
    await tx.release.deleteMany({ where: { id: { in: releaseIds } } });
    await tx.artist.delete({ where: { id } });
  });
}

// --- Release ---

export async function archiveRelease(id: string) {
  return prisma.$transaction(async (tx) => {
    const release = await tx.release.findUnique({ where: { id } });
    if (!release) throw new NotFoundError("Release not found.");

    const now = new Date();
    const trackIds = (await tx.track.findMany({ where: { releaseId: id }, select: { id: true } })).map((t) => t.id);

    await tx.track.updateMany({ where: { id: { in: trackIds }, deletedAt: null }, data: { deletedAt: now } });
    await tx.card.updateMany({
      where: { OR: [{ releaseId: id }, { trackId: { in: trackIds } }], status: { not: "REVOKED" } },
      data: { status: "REVOKED" },
    });

    return tx.release.update({ where: { id }, data: { deletedAt: now } });
  });
}

export async function restoreRelease(id: string) {
  const release = await prisma.release.findUnique({ where: { id } });
  if (!release) throw new NotFoundError("Release not found.");
  return prisma.release.update({ where: { id }, data: { deletedAt: null } });
}

export async function releaseCascadeCounts(id: string): Promise<Omit<CascadeCounts, "releases">> {
  const trackIds = (await prisma.track.findMany({ where: { releaseId: id }, select: { id: true } })).map(
    (t) => t.id,
  );
  const cards = await prisma.card.count({ where: { OR: [{ releaseId: id }, { trackId: { in: trackIds } }] } });
  return { tracks: trackIds.length, cards };
}

export async function deleteReleasePermanently(id: string) {
  return prisma.$transaction(async (tx) => {
    const release = await tx.release.findUnique({ where: { id } });
    if (!release) throw new NotFoundError("Release not found.");
    if (!release.deletedAt) throw new NotArchivedError("Archive the release before deleting it permanently.");

    const trackIds = (await tx.track.findMany({ where: { releaseId: id }, select: { id: true } })).map(
      (t) => t.id,
    );
    const cardIds = (
      await tx.card.findMany({ where: { OR: [{ releaseId: id }, { trackId: { in: trackIds } }] }, select: { id: true } })
    ).map((c) => c.id);

    await tx.playEvent.deleteMany({ where: { OR: [{ trackId: { in: trackIds } }, { cardId: { in: cardIds } }] } });
    await tx.cardOwnership.deleteMany({ where: { cardId: { in: cardIds } } });
    await tx.card.deleteMany({ where: { id: { in: cardIds } } });
    await tx.track.deleteMany({ where: { id: { in: trackIds } } });
    await tx.release.delete({ where: { id } });
  });
}

// --- Track ---

export async function archiveTrack(id: string) {
  return prisma.$transaction(async (tx) => {
    const track = await tx.track.findUnique({ where: { id } });
    if (!track) throw new NotFoundError("Track not found.");

    const now = new Date();
    await tx.card.updateMany({ where: { trackId: id, status: { not: "REVOKED" } }, data: { status: "REVOKED" } });
    return tx.track.update({ where: { id }, data: { deletedAt: now } });
  });
}

export async function restoreTrack(id: string) {
  const track = await prisma.track.findUnique({ where: { id } });
  if (!track) throw new NotFoundError("Track not found.");
  return prisma.track.update({ where: { id }, data: { deletedAt: null } });
}

export async function trackCascadeCounts(id: string): Promise<{ cards: number }> {
  return { cards: await prisma.card.count({ where: { trackId: id } }) };
}

export async function deleteTrackPermanently(id: string) {
  return prisma.$transaction(async (tx) => {
    const track = await tx.track.findUnique({ where: { id } });
    if (!track) throw new NotFoundError("Track not found.");
    if (!track.deletedAt) throw new NotArchivedError("Archive the track before deleting it permanently.");

    const cardIds = (await tx.card.findMany({ where: { trackId: id }, select: { id: true } })).map((c) => c.id);

    await tx.playEvent.deleteMany({ where: { OR: [{ trackId: id }, { cardId: { in: cardIds } }] } });
    await tx.cardOwnership.deleteMany({ where: { cardId: { in: cardIds } } });
    await tx.card.deleteMany({ where: { id: { in: cardIds } } });
    await tx.track.delete({ where: { id } });
  });
}

// --- Card ---
// No archive/restore here — Card's existing UNCLAIMED/REVOKED status
// toggle (apps/api/src/routes/admin-cards.ts) already is the soft
// delete. Permanent delete just requires that status first.

export async function deleteCardPermanently(id: string) {
  return prisma.$transaction(async (tx) => {
    const card = await tx.card.findUnique({ where: { id } });
    if (!card) throw new NotFoundError("Card not found.");
    if (card.status !== "REVOKED") throw new NotArchivedError("Revoke the card before deleting it permanently.");

    await tx.playEvent.deleteMany({ where: { cardId: id } });
    await tx.cardOwnership.deleteMany({ where: { cardId: id } });
    await tx.card.delete({ where: { id } });
  });
}
