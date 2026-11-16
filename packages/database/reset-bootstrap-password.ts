// One-off operational script — NOT part of the app. Delete after use.
// Resets the password hash on the existing bootstrap admin row (the
// one still sitting at email "admin", meaning setup was never
// completed) without touching anything else about the account.
try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional — real DATABASE_URL is passed inline for this run
}

import { hash } from "argon2";
import { prisma } from "./src/index.ts";

async function main() {
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be set.");
  }

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    throw new Error("No admin account found — use the normal seed script instead.");
  }
  if (admin.email !== "admin") {
    throw new Error(
      `Refusing to reset: this account's email is already "${admin.email}", meaning ` +
        "setup was completed — this script is only for the untouched bootstrap row.",
    );
  }

  const passwordHash = await hash(password);
  await prisma.user.update({ where: { id: admin.id }, data: { passwordHash } });
  console.log(`Reset bootstrap password for account: ${admin.email}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
