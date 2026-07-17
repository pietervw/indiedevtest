# IndieDevTest

Reciprocal testing community for indie Android & iOS developers.

**Production:** [https://indiedevtest.com](https://indiedevtest.com) (apex — no `www`)

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

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

1. Point DNS: `A` / `AAAA` for `indiedevtest.com` → your VPS. Optionally point `www` too (the app 308-redirects `www` → apex).
2. In Coolify, create a new resource from this Git repo (Dockerfile).
3. Set domain to `indiedevtest.com` (prefer generating cert for apex; redirect www in Coolify or rely on app proxy).
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
