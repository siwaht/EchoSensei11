import { defineConfig } from "drizzle-kit";

// Check if we have a DATABASE_URL, otherwise use SQLite
const isPostgres = !!process.env.DATABASE_URL;

if (isPostgres && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set for PostgreSQL");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: isPostgres ? "postgresql" : "sqlite",
  dbCredentials: isPostgres ? {
    url: process.env.DATABASE_URL!,
  } : {
    url: "./data/echosensei11.db",
  },
});
