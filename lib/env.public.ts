function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

export function isPublicOAuthEnabledClient(): boolean {
  return parseBoolean(process.env.NEXT_PUBLIC_PUBLIC_OAUTH_ENABLED, true);
}
