import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/placeholder",
  },
  verbose: true,
  strict: true,
});
