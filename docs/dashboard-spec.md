# ContexAi Master Dashboard — Spec v1

**Status:** Draft  
**Owner:** Amir W. Ahmed  
**Date:** 2026-05-25

A spec-driven design doc. We define the **contract** first (what each side returns/expects), then build both the Worker endpoints and the dashboard artifact to satisfy it. If the contract changes, both sides change together.

---

## 1. Goals

A single, re-openable dashboard surfacing the operational pulse of ContexAi:

1. **Ops** — applications received, positions posted, quota usage
2. **Revenue** — Stripe checkouts, paid-tier unlocks
3. **Engagements** — client mandates, assigned expert, deliverable status
4. **Velocity** — GitHub commits, PRs, deploys

Plus four export formats: CSV, PDF, XLSX, Markdown summary.

## 2. Non-goals (v1)

- Public/multi-user access — single-operator (Amir) only
- Real-time websocket updates — polling on Reload is fine
- Writeback (mutating data from the dashboard) — read-only views only
- Mobile-optimised layout — desktop-first, mobile-tolerant

## 3. Architecture

```
┌─────────────────────────────────────┐
│ Cowork dashboard artifact (HTML)    │
│  - 4 tabs, Chart.js + Grid.js       │
│  - Export buttons (CSV/PDF/XLSX/MD) │
└──────────────┬──────────────────────┘
               │ fetch() with Bearer token
               ▼
┌─────────────────────────────────────┐
│ contexai.org Worker                 │
│  /api/admin/applications            │
│  /api/admin/quota                   │
│  /api/admin/stripe-summary          │
│  /api/admin/engagements             │
│  /api/admin/github-snapshot         │
└──────────────┬──────────────────────┘
               │
       ┌───────┼──────────┐
       ▼       ▼          ▼
   R2 bucket  KV    Stripe API   GitHub API
   APPLICATIONS  QUOTA_KV
```

**Why this shape**

- The Worker already holds the bindings (R2, KV, Stripe secret). It's the natural data plane.
- Cowork artifacts can `fetch()` over HTTPS — no MCP wrapper needed for data we already own.
- Auth: a single `ADMIN_TOKEN` shared secret. Dashboard sends `Authorization: Bearer <token>`; Worker constant-time compares.

## 4. Auth model

- New Wrangler secret: `ADMIN_TOKEN` (32-byte random hex).
- Every `/api/admin/*` request must carry `Authorization: Bearer <ADMIN_TOKEN>`. Missing/wrong → 401.
- Token lives in dashboard's `localStorage` after first paste (`localStorage.contexai_admin_token`). Never embedded in HTML.
- CORS: extend `ALLOWED_ORIGINS` to include the Cowork artifact origin (`https://*.claude.ai` or whatever the iframe ships with) for `/api/admin/*` only.

## 5. API contract

### 5.1 `GET /api/admin/applications?kind=applications|positions|position-applications|all&since=YYYY-MM-DD`

**Response 200:**

```json
{
  "ok": true,
  "count": 12,
  "items": [
    {
      "id": "uuid",
      "kind": "application",
      "type": "subject_matter_expert",
      "submitted_at": "2026-05-20T08:14:22Z",
      "submitter_name": "Jane Doe",
      "submitter_email": "jane@example.com",
      "files": [{ "name": "cv.pdf", "size": 184320 }],
      "ip_country": "PK",
      "fields_preview": {
        "expertise_areas": "Banking, Risk Mgmt",
        "years_experience": "12"
      }
    }
  ]
}
```

### 5.2 `GET /api/admin/quota?role=employer|applicant|all`

**Response 200:**

```json
{
  "ok": true,
  "totals": { "tracked_emails": 47, "free_exhausted": 8, "paid_active": 3 },
  "rows": [
    {
      "role": "employer",
      "email": "hr@acme.com",
      "free_used": 3,
      "paid_credits": 2,
      "total_posts": 5,
      "last_post_at": "2026-05-22T10:11:00Z"
    }
  ]
}
```

### 5.3 `GET /api/admin/stripe-summary?days=30`

**Response 200:**

```json
{
  "ok": true,
  "window_days": 30,
  "total_revenue_cents": 14500,
  "currency": "usd",
  "successful_checkouts": 9,
  "by_package": { "starter": 6, "pro": 3 },
  "recent": [
    { "session_id": "cs_test_...", "email": "...", "amount": 1000, "package": "starter", "at": "..." }
  ]
}
```

Reads from R2 `purchases/` prefix (already logged by `handleStripeWebhook`). No live Stripe API call needed in v1 — webhook is our source of truth.

### 5.4 `GET /api/admin/engagements`

**Response 200:**

```json
{
  "ok": true,
  "items": [
    {
      "id": "engagement-001",
      "client": "TSH Group",
      "mandate": "REIT structuring",
      "lead_expert": "Mir Kazim Ali",
      "status": "in_progress",
      "started_at": "2026-04-15",
      "next_milestone": "Board pack review",
      "next_milestone_at": "2026-06-01"
    }
  ]
}
```

Reads from R2 key `engagements/registry.json`. Editing this file is how v1 "manages" the pipeline — no UI for it yet. A second iteration can add a write endpoint.

### 5.5 `GET /api/admin/github-snapshot`

**Response 200:**

```json
{
  "ok": true,
  "repo": "DataJinipk/contexai-website",
  "default_branch": "main",
  "latest_commits": [
    { "sha": "abc123", "message": "...", "author": "...", "at": "..." }
  ],
  "open_prs": 0,
  "open_issues": 0,
  "last_deploy_at": "..."
}
```

Worker calls `api.github.com` server-side (public repo, no auth needed for reads; can layer in a GITHUB_TOKEN secret if rate-limited).

## 6. Dashboard UI

### 6.1 Layout

- Top bar: ContexAi wordmark · current window (e.g., "Last 30 days") · Reload · Export ▾
- Tab strip: **Ops · Revenue · Engagements · Velocity**
- Each tab is a single scrollable column. KPI cards top, then tables.

### 6.2 Ops tab

- KPI row: Total Apps (30d), Open Positions (count), Free Quota Exhausted, Paid Credits Outstanding
- Chart: Submissions/day stacked by kind (last 30d) — Chart.js
- Table: All submissions, filterable by kind+date — Grid.js
- Per-row: click → modal showing full submission JSON

### 6.3 Revenue tab

- KPI row: Total Revenue (30d), Successful Checkouts, ARPU, Top Package
- Chart: Revenue/day bar chart
- Table: Recent purchases

### 6.4 Engagements tab

- KPI row: Active mandates, This-week deliverables, Experts deployed
- Table: All engagements, status-colored
- Per-row: shows next milestone + days-to-go

### 6.5 Velocity tab

- KPI row: Commits (7d), PRs open, Last deploy ago
- Chart: Commits/day spark
- Table: Recent commits

### 6.6 Export menu

| Format | Behaviour |
| --- | --- |
| **CSV** | Downloads the active tab's primary table as `.csv` |
| **PDF** | Browser print → "Save as PDF" preset (cleanest, smallest code) |
| **XLSX** | All four tab datasets as separate sheets in one workbook (SheetJS) |
| **Markdown** | `window.cowork.askClaude()` writes a narrative summary for copy-paste |

## 7. State & caching

- `localStorage` keys: `contexai_admin_token`, `contexai_dash_window`, `contexai_dash_tab`
- Cowork's transparent fetch cache handles the read freshness — header Reload busts it
- Loading states: skeleton rows, never blank

## 8. Failure modes

| Failure | UX |
| --- | --- |
| No `ADMIN_TOKEN` set in `localStorage` | Token-entry screen as first paint |
| Wrong token (401) | Token-entry screen with red error |
| Endpoint 5xx | Tab shows error card + Retry button, other tabs still work |
| Empty data | "No applications yet" empty state with link to apply page |

## 9. Open questions

1. **Engagements registry** — file lives in R2 at `engagements/registry.json`. Who edits it? For v1, manual edit via Wrangler/Cloudflare dashboard. Later: a small `/admin/engagements/edit` UI.
2. **GitHub token** — unauthenticated GitHub API rate-limits at 60 req/hr. Likely fine for v1; add a `GITHUB_TOKEN` secret if 429s show up.
3. **Live Stripe sync** — v1 reads R2 `purchases/` log. If webhook ever fails silently, we'd undercount. Iteration 2 can backstop with a daily Stripe API reconcile.

## 10. Out of scope (v2 candidates)

- Writeback (post a new engagement from the dashboard)
- Multi-tenant (other Web Expert Agents see only their mandates)
- Live notifications (Slack ping when a new SME application lands)
- Saved views / pinned filters

---

**Implementation plan:**

1. ✅ Spec (this doc)
2. ⬜ Patch `src/index.js` with `/api/admin/*` endpoints
3. ⬜ Build dashboard artifact via `mcp__cowork__create_artifact`
4. ⬜ Wrangler secret `ADMIN_TOKEN` set, deploy Worker
5. ⬜ Open dashboard, paste token, verify all four tabs
