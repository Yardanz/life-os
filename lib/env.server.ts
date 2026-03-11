import "server-only";

type EnvValidationResult = {
  ok: true;
};

let cached: EnvValidationResult | null = null;

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

export function isSoftLaunchModeEnabled(): boolean {
  return parseBoolean(process.env.SOFT_LAUNCH_MODE, false);
}

export function isPublicAppAccessEnabled(): boolean {
  return parseBoolean(process.env.PUBLIC_APP_ACCESS, true);
}

export function isPublicOAuthEnabledServer(): boolean {
  return parseBoolean(process.env.PUBLIC_OAUTH_ENABLED, true);
}

export function getNowPaymentsApiKey(): string | null {
  const value = process.env.NOWPAYMENTS_API_KEY?.trim();
  return value && value.length > 0 ? value : null;
}

export function getNowPaymentsIpnSecret(): string | null {
  const value = process.env.NOWPAYMENTS_IPN_SECRET?.trim();
  return value && value.length > 0 ? value : null;
}

export function getNowPaymentsBaseUrl(): string {
  const value = process.env.NOWPAYMENTS_BASE_URL?.trim();
  return value && value.length > 0 ? value : "https://api.nowpayments.io/v1";
}

export function getPublicAppUrl(): string {
  const value = process.env.PUBLIC_APP_URL?.trim();
  if (value && value.length > 0) return value;
  return process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
}

export function assertEnv(): EnvValidationResult {
  if (cached) return cached;

  const missing: string[] = [];

  if (!hasValue(process.env.DATABASE_URL)) {
    missing.push("DATABASE_URL");
  }

  const hasAuthSecret = hasValue(process.env.AUTH_SECRET) || hasValue(process.env.NEXTAUTH_SECRET);
  if (!hasAuthSecret) {
    missing.push("AUTH_SECRET|NEXTAUTH_SECRET");
  }

  const providerPairs: Array<[string, string]> = [
    ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
    ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"],
    ["TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET"],
  ];

  for (const [idKey, secretKey] of providerPairs) {
    const idSet = hasValue(process.env[idKey]);
    const secretSet = hasValue(process.env[secretKey]);
    if (idSet !== secretSet) {
      missing.push(`${idKey}+${secretKey}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  cached = { ok: true };
  return cached;
}
