# Garments — Tailor Management System

A full-stack TMS built with Next.js, Prisma, and Neon PostgreSQL.

## Stack

- **Frontend**: Next.js 16 (App Router), Tailwind CSS v4, Font Awesome 6
- **Backend**: Next.js API Routes
- **ORM**: Prisma 7 with `@prisma/adapter-pg`
- **Database**: Neon PostgreSQL

## Features

- **Accounts** — Walk-In Customer, Government, Supplier types with auto-generated IDs (CUS-0001, GID-0001, SUP-0001). DR/CR ledger tracking.
- **Stock / Inventory** — Items with SKU generation, variant support (size × color), barcode-ready SKUs.
- **Dashboard** — Live stats and recent activity.

## Environment Variables

Create a `.env` file with:

```
DATABASE_URL="postgresql://..."   # Pooled (PgBouncer) — runtime queries
DATABASE_URL_UNPOOLED="postgresql://..."     # Session mode — migrations / db push
```

## Development

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## Deploy

Set `DATABASE_URL` and `DIRECT_URL` in your Vercel environment variables, then push to your connected repository.

