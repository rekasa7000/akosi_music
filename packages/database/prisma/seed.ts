try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional — CI/real deployments inject env vars directly
}

import { hash } from "argon2";
import { prisma } from "../src/index.ts";

// ADMIN_BOOTSTRAP_USERNAME is deliberately not required to look like
// an email — it's a shared, temporary credential (e.g. "admin"),
// never the admin's real delivery address. The real admin enters
// their actual email on first login and verifies it there; see
// docs/12-admin-authentication.md. User.email holds the bootstrap
// username until that happens.
async function main() {
  const username = process.env.ADMIN_BOOTSTRAP_USERNAME;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD must both be set to seed the admin account.",
    );
  }

  const existing = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (existing) {
    throw new Error(
      `An admin account already exists (${existing.email}). Not re-seeding — ` +
        "this script is a one-time bootstrap, not a reset tool.",
    );
  }

  const passwordHash = await hash(password);
  const admin = await prisma.user.create({
    data: { email: username, role: "ADMIN", passwordHash },
  });

  console.log(`Seeded admin bootstrap account: ${admin.email}`);
  console.log(
    "Log in with this username and the bootstrap password — first login " +
      "will prompt for a real email, a new password, and TOTP enrollment.",
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
