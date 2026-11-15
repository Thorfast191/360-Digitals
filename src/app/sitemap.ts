import type { MetadataRoute } from "next";

import { connection } from "next/server";

// Read SITE_URL at request time, not build time.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const baseUrl = process.env.SITE_URL ?? "http://localhost:3000";
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
