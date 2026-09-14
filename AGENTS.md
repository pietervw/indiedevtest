# AGENTS.md — IndieDevTest

## Quick facts

- IndieDevTest — reciprocal mobile app testing community for indie Android & iOS developers (indiedevtest.com).
- Coolify-hosted Docker deployment (Next.js standalone output).
- Stack: Next.js App Router, Prisma + Neon Postgres, Clerk auth, Cloudflare R2 uploads, optional Sentry/Umami.

## Setup

```bash
cp .env.example .env.local
npm install
```

## Verification

- `npm run lint` — ESLint.
- `npm run test:unit` — compiles `tsconfig.test.json` and runs unit tests (e.g. validation and image limits).
- Note: a `verify:fast` interface is not yet defined in `package.json`. An untracked `.github/workflows/verify-fast.yml` exists pending its scripts — land the scripts and the workflow together (never commit the workflow alone).

## Architecture

- `src/app/` — routes (marketing pages, sign-in/sign-up Clerk hosted components, `onboarding`).
- `src/lib/` — shared logic (db, validation, email, storage).
- `prisma/` — schema, migrations, seed.
- R2 upload flow: presigned S3 PUTs to Cloudflare R2; env checks fail closed at container start (`scripts/check-storage-env.mjs` exits if `R2_*` missing).
- Cron routes under `src/app/api/cron/` are guarded by `CRON_SECRET` (Bearer token) — they send real email.

## Safety

- Never commit hardcoded secrets or `.env*` files with real values.
- `CRON_SECRET`-guarded endpoints send real emails — do not invoke them casually.
- Missing `R2_*` env vars fail the container at start by design; do not work around the check.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
