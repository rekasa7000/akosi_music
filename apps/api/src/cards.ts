import { prisma } from "@akosi/database";

// Shared "attach this card to this user" logic — written once so the
// admin's manual "mark as sold" action (no storefront/payment system
// exists yet) and the real fan claim-by-code/tap flow (once fan
// accounts exist — see POST /cards/redeem in routes/public-cards.ts)
// call the exact same code path, not two copies that can drift apart.

export async function claimCardForUser(params: {
  cardId: string;
  userId: string;
  source: "ADMIN_RECORDED" | "FAN_CLAIM";
}): Promise<void> {
  // Upsert on cardId (already @unique) rather than insert — reassigning
  // an already-CLAIMED card overwrites who owns it instead of creating
  // a second ownership row. Matches the "physical possession is the
  // proof" design: whoever claims the card now is treated as the
  // rightful owner, regardless of what was recorded before.
  await prisma.$transaction([
    prisma.cardOwnership.upsert({
      where: { cardId: params.cardId },
      create: { cardId: params.cardId, userId: params.userId, source: params.source },
      update: { userId: params.userId, source: params.source, claimedAt: new Date() },
    }),
    prisma.card.update({ where: { id: params.cardId }, data: { status: "CLAIMED" } }),
  ]);
}

// User.email is globally unique regardless of role — reusing an
// existing admin/artist account by email here is correct, not a bug
// (that's genuinely the same person). No passwordHash is set: fan auth
// doesn't exist yet (see docs/11-mvp-phase0.md), same Phase 0 gap the
// User model's own passwordHash comment already documents.
export async function findOrCreateFanByEmail(email: string): Promise<{ id: string }> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({ data: { email, role: "FAN" } });
}
