# Deploy to Vercel

## Local verification
1. `npm i`
2. `npx prisma generate`
3. `npx prisma migrate dev` (local only)
4. `npm run build`

## Vercel deploy
1. Add required environment variables in Vercel project settings:
   - `DATABASE_URL`
   - `NEXTAUTH_URL`
   - `NEXTAUTH_SECRET`
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
2. Set `NEXTAUTH_URL` to your production domain (example: `https://your-domain.com`).
3. Run database migrations with `npx prisma migrate deploy` as a separate release step when needed.
4. Deploy app build normally (`next build`/Vercel default build command).

## Migration safety
- Do not run `prisma migrate dev` during production build.
- Use `prisma migrate deploy` only for production/staging migration application.

## Common failures
- Missing `DATABASE_URL`: Prisma client initialization fails at startup/build.
- Missing `NEXTAUTH_SECRET` (or `AUTH_SECRET`): auth/session initialization fails.
- OAuth callback mismatch: provider redirects fail unless callback URL matches `NEXTAUTH_URL`.
