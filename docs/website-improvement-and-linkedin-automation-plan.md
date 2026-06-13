# ContexAi Website — Improvement Plan & LinkedIn Automation Blueprint

**Prepared:** 9 June 2026
**Scope:** `contexai-website` (Cloudflare Worker + static `public/`), target domain `contexai.org`
**Author:** Review for Amir Waheed Ahmed, Founder & Creator

---

## 1. What you have today (honest assessment)

The site is genuinely strong for a boutique advisory. Highlights:

- **Clean, modern single-page design** — serif/sans pairing, dark hero, reveal-on-scroll, responsive grid. Looks premium.
- **Real substance** — 7 founding experts with credible, specific bios (P.Eng, CPA/CA, FCA, ex-Aramco/Shell/Holcim/AION). This is your moat; lead with it.
- **Working backend** — the Cloudflare Worker (`src/index.js`) is well-built: applications + position postings to R2, per-email quota in KV, Stripe checkout with HMAC-verified webhooks, a token-gated admin/dashboard API. This is more infrastructure than most consultancies ever ship.
- **Clear three-sided model** — SMEs, Agentic-AI builders, employers. Differentiated positioning.

The gaps below are mostly about **distribution, measurement, and conversion** — exactly what a daily LinkedIn engine needs underneath it.

---

## 2. Improvement plan

### 2.1 Critical fixes (do this week — ~half a day)

| # | Issue | Where | Fix |
|---|-------|-------|-----|
| 1 | **No social-share preview.** Zero Open Graph / Twitter Card tags. Every LinkedIn/WhatsApp share of contexai.org shows no image, no title, no description — the single biggest leak for a social strategy. | `public/index.html` `<head>` | Add `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card`. **You already have the art** — `public/images/launch/launch-card.png` is sitting unused. Wire it up. |
| 2 | **Dead LinkedIn link in footer** (`href="#"`). | `index.html:926` | Point to `https://www.linkedin.com/in/amirwah/`. The whole campaign drives here — don't 404 your own funnel. |
| 3 | **Dead Privacy / Terms links** (`href="#"`). You collect applicant PII + run Stripe — you legally need a real privacy policy. | `index.html:932-933` | Add `public/privacy.html` and `public/terms.html`. |
| 4 | **Duplicate `</body></html>`** closing tags. | `index.html:1006-1009` | Remove the duplicate pair. |
| 5 | **No favicon.** Browser tabs show a blank/generic icon — looks unfinished. | `public/` | Add `favicon.ico` + `apple-touch-icon.png` and link them. |
| 6 | **README is stale/misleading** — says "deployed via Netlify to contexai.org", but the repo is actually a **Cloudflare Worker** (`wrangler.jsonc`, R2, KV, Stripe). Anyone deploying will get it wrong. | `README.md` | Rewrite to document `wrangler deploy`, secrets, and bindings. |
| 7 | **Number inconsistency** — hero says "24+ Years", About/bio says "20+ years", footer says "since 2001" (=25 yrs). | multiple | Pick one figure and use it everywhere. Credibility detail. |

### 2.2 High-impact (this month)

1. **Add analytics — non-negotiable before you start posting.** You currently have no way to measure whether LinkedIn drives traffic. Add **Cloudflare Web Analytics** (free, privacy-friendly, one snippet, no cookie banner) and tag every LinkedIn link with UTM params (`?utm_source=linkedin&utm_medium=social&utm_campaign=daily`). Without this, the whole automation is flying blind.

2. **Replace `mailto:` with a real contact form.** There are 5 `mailto:` links and **no contact endpoint** in the Worker. `mailto:` loses ~half of prospects (no mail client, mobile friction, no record). You already have the pattern — add `POST /api/contact` mirroring `handleSubmission`, store to R2, and surface in the dashboard. Every captured email is a lead the LinkedIn campaign paid for.

3. **Build a real `/insights` blog.** Today the Insights section is six static cards of placeholder copy with hard-coded dates (Jan 2026 …) that will silently rot. **This is the single most important strategic addition** — it is the *content engine* the LinkedIn automation feeds on. Each daily post should link back to an owned article on contexai.org. No blog → daily posts have nowhere to point → no traffic, no SEO compounding. Start with 6–8 short articles drawn from your experts' domains.

4. **Replace hotlinked Unsplash images** (`about__img`, `method__img`). They're not owned, can break, and slow the page. Use owned photography or licensed assets, served from `public/images/`.

5. **Strengthen testimonials.** "— CEO, Energy Company" reads as invented. Either get 2–3 attributable quotes (name, title, firm, photo) or relabel the section "Illustrative engagements" and make them case-snapshots. Anonymous praise lowers trust on a high-ticket advisory site.

### 2.3 SEO & technical (this quarter)

- Add `robots.txt` and a `sitemap.xml` (neither exists).
- Add **JSON-LD structured data**: `Organization` (with `founder`, `sameAs` → LinkedIn), `Person` for Amir, and `BlogPosting` per insight. Enables rich results and feeds AI/LLM search.
- Add `<link rel="canonical">`.
- Accessibility polish: tab buttons need `aria-selected` / `aria-controls` / `role="tabpanel"` wiring (currently only `role="tab"` on buttons).
- Performance: self-host the two Google fonts (or `font-display:swap` is already set — good) and preload the hero image.

---

## 3. LinkedIn daily-posting automation

**Goal:** Publish one high-quality post per business day to `linkedin.com/in/amirwah/`, each tied to a different slice of ContexAi's expertise, to surface developments and stay top-of-mind across a *diversified* client base — without it becoming a daily chore.

### 3.1 Compliance first (read this)

- **Compliant:** posting *your own* content via LinkedIn's official API, or via approved schedulers (Buffer, Publer, Zapier, Taplio). This is what we'll do.
- **Not compliant / risky:** tools that auto-connect, auto-DM, auto-like, or scrape (Phantombuster-style growth bots). They violate LinkedIn's User Agreement and risk account restriction. **We will not use these.** The strategy is content distribution, not engagement botting.

### 3.2 The content system (the part that actually matters)

Automation without an editorial system just publishes noise. Structure it as a **weekly pillar rotation** so each segment of your diversified base sees relevant content within any given week:

| Day | Pillar | Serves |
|-----|--------|--------|
| Mon | Financial strategy / dispute resolution | Corporates, CFOs, legal |
| Tue | Energy, petrochem, oil & gas, power | Industrial / EPC clients |
| Wed | Agentic AI & digital transformation | Enterprise, fintech, builders |
| Thu | PPP, infrastructure, sustainability/SDGs | Government, DFIs, infra |
| Fri | Real estate finance / M&A / credit risk | Investors, GCC/NA network |

Each post = **Hook → one genuine insight → soft CTA → link to a `/insights` article → 3–5 hashtags.** Rotate which expert/credential anchors the post (your bench is the differentiator). Keep it in *your* voice — first-person, opinionated, specific, no corporate filler.

A simple **Airtable content calendar** (you have the Airtable connector) is the backbone: columns for Date, Pillar, Hook, Body, Link, Status (Idea → Drafted → Approved → Published), Engagement notes. One base, ~15 min/week of curation.

### 3.3 Three implementation options

**Option A — No-code, fastest to live (recommended to start). ~1–2 hrs setup.**
Use a scheduler that already holds an approved LinkedIn integration, so you skip LinkedIn's API approval entirely:
- **Zapier** (you have it connected): trigger = scheduled / new "Approved" row in Airtable → action = *LinkedIn → Create Share Update* (authenticates as you, posts to your profile). Or
- **Buffer / Publer / Taplio** (~$6–15/mo): visual queue, best-time scheduling, analytics, drafts you approve from your phone.
- **Pros:** live this week, built-in analytics, mobile approval, no OAuth engineering.
- **Cons:** monthly fee; content still needs to be written (solved in 3.4).

**Option B — Official LinkedIn API via your existing Worker (most control, free, durable). ~1–2 days.**
You already run a Cloudflare Worker — add LinkedIn publishing to it:
- Register a LinkedIn Developer app, request **`w_member_social`** scope (Share/Posts API), OAuth once as Amir, store the refresh token as a Worker secret.
- Add `POST /api/linkedin/publish` + a **Cron Trigger** (Workers supports scheduled cron) that reads the day's approved row from Airtable/R2 and calls the Posts API.
- **Pros:** no per-post fee, fully owned, integrates with your stack, can post programmatically from the same dashboard.
- **Cons:** LinkedIn API approval can take days and is stricter for member-posting; more engineering. Best as **Phase 2** once Option A proves the cadence.

**Option C — Claude-generated drafts + human approval (pairs with A or B).**
This is the "automate the writing, not just the posting" layer, and it's where the leverage is:
- A **scheduled Claude Code routine** (via the `schedule` skill / cron) runs each morning, reads the next pillar from the Airtable calendar, drafts the post in your voice (it has full context on your experts, sectors, and `/insights` articles), and writes it to the calendar as `Drafted` + emails/pushes you a one-tap approve.
- On approval → Option A or B publishes it.
- **You stay in the loop** (approve/edit in 30 seconds) but never face a blank page.

### 3.4 Recommended rollout

1. **Week 1:** Quick fixes 2.1 (esp. OG tags + Cloudflare Analytics + LinkedIn link). Stand up the Airtable content calendar. Hand-write & post 5 days manually to find your voice and best times.
2. **Week 2:** Wire **Option A** (Zapier or Buffer) so approved rows auto-publish. Add **Option C** so Claude drafts each morning. You now have: AI drafts → you approve on phone → auto-posts. ~10 min/day.
3. **Week 3–4:** Publish the first 6–8 `/insights` articles so posts link to owned content. Start UTM-tracking and review what converts in the dashboard.
4. **Month 2+:** If volume justifies it, migrate publishing to **Option B** (Worker + LinkedIn API) to drop the SaaS fee and fully own the pipeline. Add a monthly performance review (reach, profile visits, contexai.org sessions from LinkedIn, inbound enquiries).

### 3.5 Guardrails

- **Always-approve gate** for at least the first 4–6 weeks — never let AI auto-publish to your personal brand unreviewed.
- Cap at **1 post/business day**; quality and consistency beat volume. Resist the urge to automate comments/connections.
- Keep a **kill switch** (pause the schedule) and review weekly.

---

## 4. Suggested next actions

**I can implement, on your go-ahead:**
- **(A) Quick wins** — OG/Twitter tags + wire the launch card, fix the LinkedIn/Privacy/Terms links, favicon, remove duplicate tags, reconcile the year figures, add Cloudflare Web Analytics, refresh the README. *(~half a day, all in this repo.)*
- **(B) Contact endpoint** — add `POST /api/contact` to the Worker + a real form, so you stop losing `mailto:` leads.
- **(C) `/insights` blog scaffold** + 3 starter articles drafted from your experts' domains.
- **(D) LinkedIn automation** — build the Airtable content calendar + the daily Claude drafting routine, and set up Zapier→LinkedIn publishing (needs you to authorize LinkedIn in Zapier once).

Tell me which of A–D to start with and I'll build it.
