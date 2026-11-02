# Neon setup

This app is linked to project `divine-scene-56870879`, branch `production`.
`neon deploy` applies `neon.ts` and pulls Postgres variables into `.env.local`.
It provisions backend services; the Next.js app still needs its own hosting.

- `DATABASE_URL`: pooled Postgres connection for Next.js API handlers using the existing Prisma 7 / node-postgres adapter.
- `DATABASE_URL_UNPOOLED`: direct connection for Prisma migrations.
- `NEON_BRANCH`: linked branch metadata.

Prisma loads `.env.local`, then `.env`, without overriding process variables.
Legacy `DIRECT_URL` is supported as a migration fallback. Environment files and
generated output are ignored by Git.

```sh
neon deploy
npx prisma migrate deploy
npm run build
npm run start
# In another terminal:
node scripts/smoke-neon.mjs
```

The smoke test creates a uniquely named account header through the running app,
reads it back, queries the dashboard, then deletes the test record and verifies
its absence. Override `APP_URL` to test a different local port or deployed app.

Neon Auth handles sign-in, cookie sessions, sign-out, and password changes.
`NEON_AUTH_BASE_URL` is pulled by Neon. Generate `NEON_AUTH_COOKIE_SECRET`
with at least 32 random bytes and keep it in the server environment.
All data API handlers require an authenticated user with the `admin` role.
The auth proxy remains public so users can sign in.

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` when running the smoke test.
`scripts/seed-admin.mjs` creates an account from those variables; grant its
returned user ID the role with `neon neon-auth user set-role <id> --roles admin`.
The seed script never overwrites existing users or passwords.

Driver guidance: https://neon.com/docs/connect/choose-connection
