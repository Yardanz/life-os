# Life OS

## Dev setup

1. Copy env:

```bash
cp .env.example .env
```

2. Restart PostgreSQL in Docker:

```bash
docker compose down
docker compose up -d
```

3. Run Prisma migrations:

```bash
npx prisma migrate dev
```

4. Start Next.js:

```bash
npm run dev
```

## Schema change note

After any Prisma schema change, always run:

```bash
npx prisma migrate dev
npx prisma generate
```

Then restart the dev server (`npm run dev`) so the updated Prisma client is loaded.

## DATABASE_URL source of truth (dev)

- In local development, set `DATABASE_URL` only in `life-os/.env`.
- Do not set a conflicting shell-level `DATABASE_URL`.
- Keep `life-os/.env.local`, `life-os/.env.development`, `life-os/.env.production` absent unless you intentionally override and keep a valid PostgreSQL URL.
- Local PostgreSQL port is `5434`.

Valid local example:

```bash
DATABASE_URL=postgresql://<user>:<password>@localhost:5434/<database>?schema=public
```

If Prisma ever reports `prisma://`/`prisma+postgres://` requirement in this project, regenerate normal client (not accelerate/no-engine):

```bash
npx prisma generate
```

If the error persists in dev, stop `next dev`, delete `.next`, then start again:

```bash
rm -rf .next
npm run dev
```

Alternative (Next.js in Docker):

```bash
docker compose --profile app up app
```

## Database host notes

- If Next.js runs locally (`npm run dev`), use `localhost` in `DATABASE_URL`.
- If Next.js runs inside Docker (`docker compose --profile app up app`), use `db` in `DATABASE_URL`.

`localhost` inside a container points to that same container, not to the PostgreSQL container.  
For container-to-container communication, Docker Compose service names are used as hostnames (`db`).
