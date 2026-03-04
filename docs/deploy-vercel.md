# Deploy to Vercel

## Local verification
1. `npm i`
2. `npx prisma generate`
3. `npx prisma migrate dev` (local only)
4. `npm run build`

## Vercel deploy
1. Add required environment variables in Vercel project settings:
   - `DATABASE_URL`
   - `DIRECT_DATABASE_URL`
   - `AUTH_URL`
   - `AUTH_SECRET`
   - `AUTH_TRUST_HOST=true`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `NOWPAYMENTS_API_KEY`
   - `NOWPAYMENTS_IPN_SECRET`
   - `NOWPAYMENTS_BASE_URL`
   - `PUBLIC_APP_URL`
   - `SOFT_LAUNCH_MODE`
   - `PUBLIC_APP_ACCESS`
   - `PUBLIC_OAUTH_ENABLED`
   - `SUPPORT_EMAIL`
   - `ADMIN_EMAILS` (or use `ADMIN_EMAIL` for current single-email bootstrap flow)
   - `SOFT_LAUNCH_WHITELIST`
2. Set `AUTH_URL` to your production domain (example: `https://your-domain.com`) and do not add trailing slash.
3. Run database migrations with `npx prisma migrate deploy` as a separate release step when needed.
4. Deploy app build normally (`next build`/Vercel default build command).
5. Set `DATABASE_URL` before production build. Prisma client generation is skipped when `DATABASE_URL` is missing.

## Google OAuth on Vercel
- Required Vercel env vars for this deployment:
  - `AUTH_URL=https://life-os-tau-five.vercel.app`
  - `AUTH_SECRET=<generated-random-secret>`
  - `AUTH_TRUST_HOST=true`
  - `GOOGLE_CLIENT_ID=<google-oauth-client-id>`
  - `GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>`
- Google OAuth Authorized redirect URI must exactly match:
  - `https://life-os-tau-five.vercel.app/api/auth/callback/google`
- Auth route is NextAuth standard:
  - `/api/auth/[...nextauth]`

## Migration safety
- Do not run `prisma migrate dev` during production build.
- Use `prisma migrate deploy` only for production/staging migration application.

## Auth Adapter Tables (One-time init)
- If login fails with `The table public.Account does not exist`, migrations were not applied to the target Supabase DB.
- Run once against the production database:
  1. Ensure `DIRECT_DATABASE_URL` points to `db.<ref>.supabase.co:5432`.
  2. Run `npx prisma migrate deploy`.
  3. Verify with `npx prisma migrate status`.
- Existing repos with committed migrations should use `migrate deploy` (not `migrate dev`) for production init.

## Initializing Supabase DB
- Set runtime `DATABASE_URL` to Supabase **pooler** host (`<ref>.pooler.supabase.com`, usually `:6543`).
- Set `DIRECT_DATABASE_URL` to Supabase **direct** host (`db.<ref>.supabase.co`, usually `:5432`) for CLI migrations.
- If `DIRECT_DATABASE_URL` is missing, run migrations with `DATABASE_URL` temporarily pointed to the direct URL in your local shell session.
- Quick apply flow for empty Supabase projects:
  1. `npx prisma db push` (forces schema objects immediately, including Auth adapter tables).
  2. If migrations already exist, run `npx prisma migrate deploy`.
  3. If no migrations exist yet, create initial migration in a controlled local workflow (`npx prisma migrate dev --name init`) and commit it.
- Run `npx prisma generate` after deploy.
- Never run `prisma migrate dev` against production.

## DB Connectivity Check
- Use `GET /api/health/db` for a lightweight runtime DB probe (`SELECT 1`).
- Response includes env presence flags only: `hasDatabaseUrl`, `hasDirectUrl`, `hasPoolerUrl`.
- On failure, response includes `messageId` for server log correlation.
- Use `npm run db:info` (runtime URL) and `npm run db:info:migrate` (direct-or-fallback URL) to print safe DB target info.

## Common failures
- Missing `DATABASE_URL`: Prisma client initialization fails at startup/build.
- Wrong Supabase host type:
  - Runtime should use pooler (`DATABASE_URL`).
  - Migrations should use direct (`DIRECT_DATABASE_URL`).
- Missing `AUTH_SECRET` (or `NEXTAUTH_SECRET` alias): auth/session initialization fails.
- OAuth callback mismatch: provider redirects fail unless callback URL matches `AUTH_URL`.
