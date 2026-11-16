// One-off read-only diagnostic — NOT part of the app. Delete after use.
try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional — real DATABASE_URL is passed inline for this run
}

import { prisma } from "./src/index.ts";

async function main() {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
  if (admins.length === 0) {
    console.log("No ADMIN rows found at all.");
    return;
  }
  for (const a of admins) {
    console.log({
      id: a.id,
      email: a.email,
      emailVerifiedAt: a.emailVerifiedAt,
      passwordSetAt: a.passwordSetAt,
      totpConfirmedAt: a.totpConfirmedAt,
      hasPasswordHash: a.passwordHash != null,
      updatedAt: a.updatedAt,
      createdAt: a.createdAt,
    });
  }
}

main()
  .catch((err) => console.error(err instanceof Error ? err.message : err))
  .finally(() => prisma.$disconnect());
