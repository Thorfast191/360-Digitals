import type { MetadataRoute } from "next";

import { connection } from "next/server";

// Read SITE_URL at request time, not build time.
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const baseUrl = process.env.SITE_URL ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
