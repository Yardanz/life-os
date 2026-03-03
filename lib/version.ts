const RC_VERSION = "0.1.0-rc.1";

export const SYSTEM_VERSION =
  process.env.NEXT_PUBLIC_VERSION ?? process.env.VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? RC_VERSION;
