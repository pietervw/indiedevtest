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

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See `.env.example`. Required in production:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://indiedevtest.com` (canonical / SEO / sitemap / llms.txt) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile public key |
| `TURNSTILE_SECRET_KEY` | Turnstile server verify secret |
| `SENDGRID_API_KEY` | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | `admin@indiedevtest.com` |
| `CONTACT_TO_EMAIL` | `contact@indiedevtest.com` (inbox only — not shown on the site) |

`NEXT_PUBLIC_*` values are inlined at **build** time. Set them as Coolify build args / build-time env as well as runtime env.

## Deploy on Coolify (Docker)

This app uses Next.js `output: "standalone"` and ships a production `Dockerfile`.

1. Point DNS: `A` / `AAAA` for `indiedevtest.com` → your VPS. Also point `www` if you want the apex redirect to work.
2. In Coolify, create a new resource from this Git repo (Dockerfile).
3. Set domains/aliases for both `indiedevtest.com` and `www.indiedevtest.com` so TLS covers www before the app’s 308 redirect to apex (or terminate the www→apex redirect at the proxy with a valid www cert).
4. Add all env vars from `.env.example`.
5. Pass build-time args for public vars:
   - `NEXT_PUBLIC_SITE_URL=https://indiedevtest.com`
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY=…`
6. Persist waitlist data: mount a volume at `/app/data`.
7. Exposed port: `3000`.
8. Deploy.

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
```
