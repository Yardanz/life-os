# Deploy to Vercel

## Local verification
1. `npm i`
2. `npx prisma generate`
3. `npx prisma migrate dev` (local only)
4. `npm run build`

## Vercel deploy
1. Add required environment variables in Vercel project settings:
   - `DATABASE_URL`
   - `AUTH_URL`
   - `AUTH_SECRET`
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
  - `GOOGLE_CLIENT_ID=<google-oauth-client-id>`
  - `GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>`
- Google OAuth Authorized redirect URI must exactly match:
  - `https://life-os-tau-five.vercel.app/api/auth/callback/google`
- Auth route is NextAuth standard:
  - `/api/auth/[...nextauth]`

## Migration safety
- Do not run `prisma migrate dev` during production build.
- Use `prisma migrate deploy` only for production/staging migration application.

## Initializing Supabase DB
- Use the Supabase **direct** Postgres connection string in `DATABASE_URL`.
- Run `npx prisma migrate deploy` to apply committed migrations safely.
- Run `npx prisma generate` after deploy.
- Never run `prisma migrate dev` against production.

## Common failures
- Missing `DATABASE_URL`: Prisma client initialization fails at startup/build.
- Missing `AUTH_SECRET` (or `NEXTAUTH_SECRET` alias): auth/session initialization fails.
- OAuth callback mismatch: provider redirects fail unless callback URL matches `AUTH_URL`.
