import type { MetadataRoute } from "next";

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = resolveSiteUrl();
  const now = new Date();
  const paths = ["/", "/demo", "/pricing", "/release", "/operator", "/support", "/security", "/status", "/privacy", "/refund", "/terms"];

  return paths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
  }));
}
