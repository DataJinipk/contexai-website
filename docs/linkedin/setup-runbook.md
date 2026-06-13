# ContexAi — LinkedIn Daily Posting: Setup Runbook

Goal: one high-quality post per business day to **linkedin.com/in/amirwah/**, drafted by AI,
approved by Amir in ~30 seconds, auto-published — serving a diversified client base across the
five content pillars.

This folder contains the whole system:
- `daily-post-generator.md` — the AI brief (voice, structure, rules, pillar rotation).
- `starter-posts.md` — 10 ready-to-publish posts to start **today**.
- `content-calendar.csv` — 4 weeks of seeded ideas mapped to pillars (import to Airtable/Sheets).
- `setup-runbook.md` — this file.

> **Compliance:** we only publish *our own* content via LinkedIn's official API or an approved
> scheduler (Zapier / Buffer / Publer). We do **not** use auto-connect, auto-DM, auto-engage, or
> scraping tools — those violate LinkedIn's User Agreement and risk the account. Distribution, not botting.

---

## Phase 0 — This week (no automation needed)

1. Activate Cloudflare Web Analytics on contexai.org (token in `public/index.html`, commented).
2. Create the content calendar: import `content-calendar.csv` into a new **Airtable base** ("LinkedIn Content")
   or a Google Sheet. Columns: Date, Day, Pillar, Status (Idea→Drafted→Approved→Published), Hook, Link, Draft, Notes.
3. Post the first 5 from `starter-posts.md` by hand, one per business day. Note which times/topics land best.
   This calibrates voice and best-time before you automate.

## Phase 1 — Publishing automation (pick ONE)

### Option A — No-code scheduler (recommended to start, ~1–2 hrs)

**A1. Zapier (you already have it connected):**
1. In Zapier, connect your **LinkedIn** account (this authorises posting as Amir — one-time OAuth).
2. Build a Zap:
   - **Trigger:** Schedule by Zapier (every weekday at your best time) — *or* Airtable "New/updated record" where `Status = Approved`.
   - **Action:** LinkedIn → *Create Share Update* → map the `Draft` field. (Add a second action to post the link as the first comment if you use links.)
3. Turn it on. Approved rows now publish automatically.

**A2. Buffer / Publer / Taplio (≈$6–15/mo) — if you want a visual queue + best-time + analytics:**
1. Connect your LinkedIn profile.
2. Approve drafts from the mobile app; they post on schedule. Simplest hands-on option.

### Option B — Official LinkedIn API via your Cloudflare Worker (Phase 2, free, fully owned, ~1–2 days)

You already run a Worker — add publishing to it:
1. Create a LinkedIn Developer app; request the **`w_member_social`** scope (Share/Posts API). Member-posting
   approval can take a few days, so do this in parallel with Option A.
2. OAuth once as Amir; store the refresh token as a Worker secret (`wrangler secret put LINKEDIN_TOKEN`).
3. Add `POST /api/linkedin/publish` (reads the day's approved row, calls the LinkedIn Posts API).
4. Add a Cloudflare **Cron Trigger** (e.g. `0 6 * * 1-5`) to fire it on weekdays.
   *(Ask Claude to implement this endpoint + cron when you're ready — the Worker already has the patterns.)*

## Phase 2 — Drafting automation (the real time-saver)

Automate the writing, not just the posting:
1. Use the **`schedule`** skill / a scheduled Claude routine to run each weekday morning.
2. It reads the next `Idea` row from the calendar, applies `daily-post-generator.md`, drafts the post in Amir's
   voice (it has full context on the experts, sectors, and `/insights` articles), and writes it back as `Drafted`
   + sends Amir a push/email.
3. Amir taps **Approve** (or edits) → Status becomes `Approved` → Option A/B publishes it.

Net: ~10 minutes/day, never a blank page, full editorial control.

## Phase 3 — Measure & compound (monthly)

- Track in the dashboard / Cloudflare Analytics: profile views, post impressions, **sessions to contexai.org from LinkedIn (UTM)**, and inbound enquiries via `/contact`.
- Double down on the pillars and formats that convert. Turn the best posts into new `/insights` articles, and the best articles into post series.

---

## Guardrails

- **Always-approve gate** for the first 4–6 weeks. Never auto-publish to a personal brand unreviewed.
- **1 post / business day.** Consistency beats volume. No automated comments or connections.
- **Kill switch:** keep the schedule pausable; review weekly.
- Never publish confidential or client-identifying detail; never invent stats or testimonials.

## What needs Amir (can't be automated for you)

1. Authorising LinkedIn inside Zapier/Buffer (one-time OAuth — only the account owner can).
2. Choosing the publish time and whether posts auto-publish or wait for approval.
3. Approving the LinkedIn Developer app if you go the Option B / API route.

Once #1 and #2 are decided, ask Claude to wire the Zap (or build the Worker endpoint + cron) and to stand up the daily drafting routine.
