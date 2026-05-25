# Dashboard Deployment — Step-by-Step

This walks you through getting the dashboard live at `https://contexai.org/dashboard.html`.

## What just shipped (already in your repo)

1. `docs/dashboard-spec.md` — the contract (read first, ~5 min)
2. `src/index.js` — Worker now exposes 5 admin endpoints under `/api/admin/*`
3. `public/dashboard.html` — the dashboard UI (single file, ~700 lines)
4. `docs/dashboard-deploy.md` — this doc

No existing routes were changed. Adds: `/api/admin/applications`, `/api/admin/quota`, `/api/admin/stripe-summary`, `/api/admin/engagements`, `/api/admin/github-snapshot`, `/dashboard.html`.

---

## 1. Generate an ADMIN_TOKEN

This is a long random string that gates all admin endpoints. Generate it once, store it somewhere safe (1Password, your notes), and you'll paste it into the dashboard the first time you open it.

```powershell
# In PowerShell
$bytes = New-Object byte[] 32
[Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
$token = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
Write-Host $token
```

That prints a 64-character hex string. Copy it.

## 2. Set the secret in Cloudflare

```powershell
cd C:\Users\amirw\contexai-website
npx wrangler secret put ADMIN_TOKEN
# Paste the token at the prompt, press Enter
```

Optional secret — only if GitHub starts rate-limiting (unlikely at v1 volume, but cheap insurance):

```powershell
npx wrangler secret put GITHUB_TOKEN
# Paste a GitHub personal access token (no scopes needed for public repo reads)
```

## 3. Deploy the Worker

```powershell
cd C:\Users\amirw\contexai-website
npx wrangler deploy
```

You should see something like:

```
Published contexai-website (X.XX sec)
  https://contexai.org
```

## 4. Open the dashboard

Open `https://contexai.org/dashboard.html` in your browser.

You'll see a token-entry screen. Paste the `ADMIN_TOKEN` from step 1. Click **Open dashboard**.

The token gets stored in your browser's `localStorage` so you only paste it the first time. **Sign out** in the Export menu clears it.

## 5. Verify each tab loads

- **Ops** — should show submissions counters. If no submissions in the time window, you'll see "No submissions in this window." (Empty state is normal until apps come in.)
- **Revenue** — shows purchases. Until you set Stripe price IDs and someone buys credits, this stays empty.
- **Engagements** — will say "No engagements tracked yet" until you create the registry file (see section 6).
- **Velocity** — should immediately show commits from `DataJinipk/contexai-website`. This is the easiest tab to verify the dashboard is working — if it doesn't show commits, something is wrong.

## 6. Optional: create the engagements registry

This is how you populate the Engagements tab. Create a JSON file with your live mandates:

```powershell
# Save as engagements.json
@'
{
  "items": [
    {
      "id": "tsh-reit-001",
      "client": "TSH Group",
      "mandate": "REIT structuring & Board pack",
      "lead_expert": "Mir Kazim Ali",
      "status": "in_progress",
      "started_at": "2026-04-15",
      "next_milestone": "Final IM & Board deck",
      "next_milestone_at": "2026-06-01"
    },
    {
      "id": "smfb-strategic-001",
      "client": "Sindh Microfinance Bank",
      "mandate": "Strategic Plan 2026-2030",
      "lead_expert": "Amir W. Ahmed",
      "status": "planned",
      "next_milestone": "Kick-off workshop",
      "next_milestone_at": "2026-06-10"
    }
  ]
}
'@ | Out-File engagements.json -Encoding utf8

# Upload to R2
npx wrangler r2 object put contexai-applications/engagements/registry.json --file engagements.json --content-type "application/json" --remote
```

Reload the dashboard. The Engagements tab should now show two rows.

To edit later: re-run the upload with an updated `engagements.json`.

## 7. Push the changes to GitHub

```powershell
cd C:\Users\amirw\contexai-website
git add docs/dashboard-spec.md docs/dashboard-deploy.md src/index.js public/dashboard.html
git status
git commit -m "feat(dashboard): admin endpoints + operational dashboard at /dashboard.html"
git push origin main
```

The dashboard isn't linked from anywhere on the public site by design — only you have the URL and the token.

---

## What this gives you

| Tab | Reads from | Refresh rhythm |
| --- | --- | --- |
| Ops | R2 `applications/`, `positions/`, `position-applications/` | On every Reload |
| Revenue | R2 `purchases/` (Stripe webhook log) + KV quota namespace | On every Reload |
| Engagements | R2 `engagements/registry.json` | When you re-upload |
| Velocity | api.github.com (public reads) | On every Reload |

## Export menu

| Button | What it does |
| --- | --- |
| **Active table as CSV** | Downloads the visible tab's main table |
| **Print / Save as PDF** | Browser print → "Save as PDF" |
| **All data as XLSX** | One workbook, 5 sheets (Applications, Quota, Purchases, Engagements, Commits) |
| **Markdown summary** | A short snapshot doc, copy-paste into Slack/Notion/email |

## Security notes

- The dashboard isn't linked from the public site. URL + token = access.
- Token is constant-time compared in the Worker (`timingSafeEqual`).
- CORS for admin endpoints allows `contexai.org`, `*.workers.dev`, `claude.ai` origins, and sandboxed `null` origins. Refuses everything else.
- All admin endpoints are GET-only (read-only). The dashboard can't mutate data; you'd have to use Wrangler/the Cloudflare console.
- Rotate the token by re-running `npx wrangler secret put ADMIN_TOKEN` with a fresh value — old token instantly invalid.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Token-entry says "Could not reach server" | Worker not deployed or domain misrouted | `npx wrangler deploy` again, then test `curl https://contexai.org/api/quota?email=foo&role=employer` |
| All tabs show errors | `ADMIN_TOKEN` not set | `npx wrangler secret put ADMIN_TOKEN` then redeploy |
| Velocity tab empty but no error | GitHub rate-limit (60/hr unauth) | Set `GITHUB_TOKEN` secret |
| Engagements says "Registry not yet created" | Normal until step 6 done | Upload the JSON to R2 as shown |
| Ops tab loads but missing data | Submissions older than the window | Switch the time window dropdown to "Last 12 months" |

## Iterating

Spec-driven flow — if you want to change what the dashboard shows:

1. Edit `docs/dashboard-spec.md` (the contract)
2. Update the Worker endpoint in `src/index.js`
3. Update the renderer in `public/dashboard.html`
4. `npx wrangler deploy`

Both ends move together because the spec is the source of truth.
