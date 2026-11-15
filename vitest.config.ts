import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // DB-backed tests share one Postgres; run files serially.
    fileParallelism: false,
    // DB tests opt in via TEST_DATABASE_URL and never fall back to DATABASE_URL,
    // so `pnpm test` can't touch the dev or production database by accident.
    env: process.env.TEST_DATABASE_URL ? { DATABASE_URL: process.env.TEST_DATABASE_URL } : {},
  },
});
