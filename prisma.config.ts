import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations need a direct (non-pooled) connection — a PgBouncer/Neon-style transaction pooler
// doesn't preserve session state, so `prisma migrate deploy`'s advisory lock can hang or time out
// against it (see https://pris.ly/d/migrate-advisory-locking). DIRECT_URL should point at the
// unpooled connection string; DATABASE_URL (used by the running app's Prisma Client adapter in
// lib/prisma.ts) can stay pooled. Falls back to DATABASE_URL when DIRECT_URL isn't set, so local
// dev against a single non-pooled Postgres instance keeps working unchanged.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
