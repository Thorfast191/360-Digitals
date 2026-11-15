// Shared guard for DB-backed tests. Run them with e.g.
//   TEST_DATABASE_URL=postgresql://…/agency_audit pnpm test
export const testDbUrl = process.env.TEST_DATABASE_URL;

if (testDbUrl && /agency_dev|production/.test(testDbUrl)) {
  throw new Error("TEST_DATABASE_URL points at a dev/production database — refusing to run.");
}

export const hasTestDb = Boolean(testDbUrl);
