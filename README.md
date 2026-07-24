# IndieDevTest

Reciprocal testing community for indie Android & iOS developers.

**Production:** [https://indiedevtest.com](https://indiedevtest.com) (apex — no `www`)

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

In `.env.local`, override production defaults for local use:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

(Those Turnstile values are Cloudflare’s Always Pass test keys.)

Apply the database schema once (uses `DIRECT_URL`):

```bash
npm run db:migrate
```

Open [http://localhost:3000](http://localhost:3000) and use Clerk’s **Sign in** / **Sign up** buttons (Account Portal — hosted by Clerk, not custom app routes).

## Environment variables

See `.env.example`. Required in production:

| Variable                                              | Purpose                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                | `https://indiedevtest.com` (canonical / SEO / sitemap / llms.txt)                            |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`                      | Cloudflare Turnstile public key (contact + waitlist)                                         |
| `TURNSTILE_SECRET_KEY`                                | Turnstile server verify secret                                                               |
| `SENDGRID_API_KEY`                                    | SendGrid API key                                                                             |
| `SENDGRID_FROM_EMAIL`                                 | `admin@indiedevtest.com`                                                                     |
| `CONTACT_TO_EMAIL`                                    | Inbox for contact + waitlist alerts (not shown on the site)                                  |
| `DATABASE_URL`                                        | Neon pooled Postgres URL (app / Prisma Client)                                               |
| `DIRECT_URL`                                          | Neon direct (non-pooler) URL for Prisma migrate                                              |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                   | Clerk publishable key                                                                        |
| `CLERK_SECRET_KEY`                                    | Clerk secret key                                                                             |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                       | `/sign-in` (Clerk hosted component route)                                                    |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                       | `/sign-up` (Clerk hosted component route)                                                    |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`     | After sign-in → `/onboarding`                                                                |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`     | After sign-up → `/onboarding`                                                                |
| `NEXT_PUBLIC_UMAMI_SRC`                               | (optional) Umami script URL — both Umami vars required to enable                             |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID`                        | (optional) Umami website id                                                                  |
| `NEXT_PUBLIC_SENTRY_DSN`                              | (optional) Sentry browser DSN; inlined at build time                                         |
| `SENTRY_DSN`                                          | (optional) Sentry server/edge DSN; falls back to `NEXT_PUBLIC_SENTRY_DSN`                    |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | (optional) Sentry source-map upload credentials; builds skip upload unless all three are set |
| `PUSHOVER_API_TOKEN`                                  | (optional) Pushover app token — both Pushover vars required to enable                        |
| `PUSHOVER_USER_KEY`                                   | (optional) Pushover user/group key (waitlist + contact alerts)                               |
| `CRON_SECRET`                                         | Bearer token for `/api/cron/*` scheduler routes (reminders + R2 deletion outbox)             |
| `R2_ACCOUNT_ID`                                       | Cloudflare account id for R2 S3 API                                                          |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`           | R2 S3 API token (Object Read & Write)                                                        |
| `R2_BUCKET`                                           | `indiedevtest`                                                                               |
| `R2_PUBLIC_BASE_URL`                                  | Public CDN base URL (custom domain or `*.r2.dev`), no trailing slash                         |

`NEXT_PUBLIC_*` values are inlined at **build** time. Set them as Coolify build args / build-time env as well as runtime env.

Container start runs `node scripts/check-storage-env.mjs` and **exits** if any `R2_*` var is missing. `ALLOW_MISSING_R2=1` is only for Docker image builds without runtime secrets and is rejected when `NODE_ENV=production` (do not set it in Coolify).

### Cloudflare R2 setup

1. Create bucket `indiedevtest` and an **R2 S3 API token** (Dashboard → R2 → **Manage R2 API Tokens**) with Object Read & Write on that bucket. Set `R2_ACCESS_KEY_ID` to the token’s **Access Key ID** (exactly 32 characters) and `R2_SECRET_ACCESS_KEY` to its **Secret Access Key**. A Cloudflare API token (`cfut_…`, Account API token value, etc.) will make browser uploads fail with a 400 that looks like a CORS error.
2. Enable public access via a custom domain (recommended) or `r2.dev` URL; set `R2_PUBLIC_BASE_URL` to that origin.
3. Apply CORS from [`r2-cors.json`](./r2-cors.json) so browsers can `PUT` uploads and `GET` images from `indiedevtest.com` / localhost. Re-apply after changing that file — the JSON in the repo does not update the live bucket by itself:
   - `npm run apply:r2-cors` (loads `.env.local`/`.env` when present; exported `R2_*` vars also work), or
   - Cloudflare Dashboard → R2 → bucket → Settings → CORS (paste the file contents).
4. Object keys use prefixes `listings/` (app screenshots) and `test-feedback/` (tester evidence).

### Scheduled jobs (Coolify)

Set `CRON_SECRET` in the service env, then add a Coolify scheduled task that calls the cron route with a Bearer token (GET or POST):

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$NEXT_PUBLIC_SITE_URL/api/cron/listing-14-day-reminders"

# Retry failed R2 object deletions (every few minutes):
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$NEXT_PUBLIC_SITE_URL/api/cron/storage-object-deletions"
```

Unauthenticated callers receive `401` with no job details. A successful run returns a small JSON summary (`checked`, `sent`, `skipped`, `failed`).

## Deploy on Coolify (Docker)

This app uses Next.js `output: "standalone"` and ships a production `Dockerfile`.

1. Point DNS: `A` / `AAAA` for `indiedevtest.com` → your VPS. Also point `www` if you want the apex redirect to work.
2. In Coolify, create a new resource from this Git repo (Dockerfile).
3. Set domains/aliases for both `indiedevtest.com` and `www.indiedevtest.com` so TLS covers www before the app’s 308 redirect to apex (or terminate the www→apex redirect at the proxy with a valid www cert).
4. Add all env vars from `.env.example` (including Clerk + Neon).
5. Pass build-time args for public vars:
   - `NEXT_PUBLIC_SITE_URL=https://indiedevtest.com`
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY=…`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=…`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/onboarding`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding`
   - `NEXT_PUBLIC_UMAMI_SRC=…` / `NEXT_PUBLIC_UMAMI_WEBSITE_ID=…` (optional)
   - `NEXT_PUBLIC_SENTRY_DSN=…` (optional, enables browser Sentry events)
    - `SENTRY_ORG=…` / `SENTRY_PROJECT=…` (optional, identifies the Sentry project for source-map upload)
    - Provide `SENTRY_AUTH_TOKEN` only as a BuildKit secret named `sentry_auth_token` (for example, `docker build --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN …`). Source maps upload only when the secret, org, and project are all present.
6. Run `npx prisma migrate deploy` against production `DIRECT_URL` before or on first deploy.
7. Persist waitlist data: mount a volume at `/app/data`.
8. Exposed port: `3000`.
9. Deploy.

Useful checks after go-live:

- https://indiedevtest.com/robots.txt
- https://indiedevtest.com/sitemap.xml
- https://indiedevtest.com/llms.txt
- https://indiedevtest.com/llms-full.txt
- https://www.indiedevtest.com → 308 → apex

## Scripts

```bash
npm run lint
npm run build
npm start
npm run db:migrate   # create / apply migrations (dev)
npm run db:push      # push schema without migration files
npm run db:seed      # seed demo community users + apps
npm run db:studio    # Prisma Studio
```
