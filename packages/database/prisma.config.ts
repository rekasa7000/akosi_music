import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional (e.g. CI providing DATABASE_URL directly)
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrate: {
    async adapter() {
      return new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    },
  },
});
