// Runs once when the Node server boots. Refuse to start a production server
// with placeholder secrets or a localhost SITE_URL (audit D-11) — both fail
// silently otherwise: forgeable sessions, and wrong sitemap/OG/canonical URLs.
export async function register() {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SKIP_ENV_CHECK === "1") return;

  const problems: string[] = [];
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32 || secret === "changeme") {
    problems.push("AUTH_SECRET is missing, a placeholder, or shorter than 32 chars (openssl rand -base64 32)");
  }
  const siteUrl = process.env.SITE_URL ?? "";
  if (!/^https?:\/\//.test(siteUrl) || /localhost|127\.0\.0\.1/.test(siteUrl)) {
    problems.push("SITE_URL must be the public origin, e.g. https://example.com");
  }
  if (problems.length > 0) {
    throw new Error(`Refusing to start in production:\n - ${problems.join("\n - ")}`);
  }
}
