# ContexAi Group — Website

Production website for **ContexAi Group** — a boutique financial consulting and strategic advisory practice, and a curated marketplace connecting senior consultants (Subject Matter Experts), Agentic AI builders, and employers across Pakistan and emerging markets.

**Live:** https://contexai.org

## Stack

This is a **Cloudflare Worker** (not Netlify — older docs were wrong). The Worker serves the static `public/` site and adds a small API.

- **`src/index.js`** — the Worker: static asset routing + JSON API.
- **`public/`** — the static site (homepage, apply/positions pages, dashboard, images).
- **`wrangler.jsonc`** — Worker config and bindings.

### Bindings (see `wrangler.jsonc`)

| Binding | Type | Purpose |
|---------|------|---------|
| `ASSETS` | Static assets | Serves everything in `public/` |
| `APPLICATIONS` | R2 bucket | Stores submissions + uploaded files + Stripe purchase logs |
| `QUOTA_KV` | KV namespace | Per-email posting/application quota counters |

### API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/apply` | SME / AI-builder applications |
| POST | `/api/post-position` | Employer position postings (quota-gated) |
| POST | `/api/apply-position` | Applications to a posted role (quota-gated) |
| POST | `/api/checkout-session` | Create a Stripe Checkout session |
| POST | `/api/stripe-webhook` | Stripe webhook receiver (HMAC-verified) |
| GET | `/api/quota` | Remaining quota for an email |
| GET | `/api/admin/*` | Read-only dashboard data (Bearer `ADMIN_TOKEN`) |

### Secrets (set via `wrangler secret put <NAME>`)

```
STRIPE_SECRET_KEY        # sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET    # whsec_...
STRIPE_PRICE_STARTER     # price_...  (5 posts / $10)
STRIPE_PRICE_PRO         # price_...  (20 posts / $25)
ADMIN_TOKEN              # bearer token gating /api/admin/*
GITHUB_TOKEN             # optional — raises GitHub API rate limit for the dashboard
```

## Develop & deploy

```bash
npm install
npx wrangler dev          # local dev at http://localhost:8787
npx wrangler deploy       # deploy to Cloudflare
```

## Pages (clean URLs, resolved by the assets binding)

| URL | File |
|-----|------|
| `/` | `public/index.html` |
| `/positions` | `public/positions.html` |
| `/apply` | `public/apply.html` |
| `/post-position` | `public/post-position.html` |
| `/apply-position` | `public/apply-position.html` |
| `/dashboard` | `public/dashboard.html` |
| `/privacy` | `public/privacy.html` |
| `/terms` | `public/terms.html` |

## Folder layout

```
src/index.js          ← Cloudflare Worker (API + asset routing)
public/               ← static site (deployed)
  index.html          ← homepage
  privacy.html, terms.html
  robots.txt, sitemap.xml, favicon.svg
  images/             ← owned imagery, expert photos, launch social cards
docs/                 ← specs, org charts, plans
agents/               ← internal control-center pages & agent skill files
_archive/             ← legacy drafts, NOT deployed
wrangler.jsonc        ← Worker config & bindings
```

## SEO / social

- Open Graph + Twitter cards in `index.html` use `public/images/launch/launch-card.png` for link previews.
- `robots.txt` + `sitemap.xml` are live.
- **Cloudflare Web Analytics** snippet is in `index.html` (commented) — add your token to activate.

## Notes

- Venture brand pages (`Apni_Sawari_Website.html`, etc.) live at repo root and are **not** deployed. Move one into `public/` to publish it.
- See `docs/website-improvement-and-linkedin-automation-plan.md` for the current improvement roadmap and the LinkedIn daily-posting automation blueprint.
