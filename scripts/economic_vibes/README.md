# Economic Vibes — autonomous daily pipeline

Runs the whole "Economic Vibes — Morning Brief" **in GitHub's cloud** on a schedule, so it
fires whether or not any laptop is on. It mirrors `C:\ContexAi\EconomicVibes\DAILY-RUNBOOK.md`,
run server-side.

## What it does each run

1. **Research + write** — `build_brief.py` calls the **Claude API** with server-side web search,
   verifies figures across ≥2 licensed sources, and returns a strict JSON payload (data + narrative,
   every figure tagged `V`/`EST.`).
2. **Render** — a print one-pager (Jinja → WeasyPrint **PDF**), the public **web page**
   (`public/economic-vibes.html`), and an optional **DOCX** (pandoc).
3. **Update the site** — rewrites the page, replaces the `EV-DATA` and `EV-NEWS` ticker blocks in
   `public/index.html` (two identical copies each), bumps `sitemap.xml`.
4. **Commit & push** — the workflow pushes `public/` to `main`, which triggers the Cloudflare deploy;
   `smoke.yml` validates ~60s later.
5. **Post** — `post_linkedin.py` (ContexAi Group page) and `post_whatsapp.py`.

## Schedule

`.github/workflows/economic-vibes.yml` → cron `30 1 * * 1-5` = **06:30 AM PKT (UTC+5), Mon–Fri**.
GitHub cron is best-effort and can lag a few minutes under load. Run it any time from the **Actions
tab → economic-vibes → Run workflow** (set `dry_run=true` to build + commit without posting).

## One-time setup (you must do this — I can't add credentials headlessly)

In the repo → **Settings → Secrets and variables → Actions**:

**Variables**
| name | value |
|------|-------|
| `CLAUDE_MODEL` | your current model string, e.g. `claude-sonnet-4-5` |

**Secrets**
| name | purpose |
|------|---------|
| `ANTHROPIC_API_KEY` | Claude API key for the research + writing step |
| `LINKEDIN_ACCESS_TOKEN` | OAuth token for a ContexAi Group **page admin**, scope `w_organization_social` |
| `WHATSAPP_TOKEN` | WhatsApp Cloud API token *(optional — see note)* |
| `WHATSAPP_PHONE_ID` | Cloud API sender phone-number id *(optional)* |
| `WHATSAPP_TO` | recipient in E.164, e.g. `9231XXXXXXXX` *(optional)* |

`GITHUB_TOKEN` is provided automatically; the workflow already has `contents: write` to push.

### LinkedIn token
The UGC post needs a token minted for an app with the **Community Management API** / `w_organization_social`
product, authorized by a Page admin. Personal tokens won't post to the company page. If the token expires,
the LinkedIn step fails (visible in the log) but **does not block the site deploy** (`continue-on-error`).

### WhatsApp reality (important)
Meta provides **no official API to post into a WhatsApp _Channel_.** `post_whatsapp.py` therefore sends the
caption + PDF via the **Cloud API to a configured number** (`WHATSAPP_TO`) — e.g. your admin line, which you
forward into the Channel, or opted-in subscribers. If those secrets are absent it simply prints the caption
and the public PDF URL for manual posting. To fully automate a Channel, swap in a third-party provider
(360dialog / Whapi) inside `post_whatsapp.py`.

## Test it safely
1. Add `ANTHROPIC_API_KEY` + `CLAUDE_MODEL` first.
2. Actions → **economic-vibes** → **Run workflow** with **dry_run = true**.
3. Check the committed `public/economic-vibes.html`, the new PDF, and the run **artifacts**
   (`out/linkedin.txt`, `out/whatsapp.txt`, the PDF). The build fails loudly if the disclaimer is
   missing or the forbidden phrase "Wealth Street" appears.
4. Add the LinkedIn/WhatsApp secrets, then run again with `dry_run = false`.

## Files
```
.github/workflows/economic-vibes.yml   cloud cron + steps
scripts/economic_vibes/
  build_brief.py         orchestrator (Claude API → render → update site)
  template_brief.html.j2 print one-pager (→ PDF)
  template_page.html.j2  public web page
  post_linkedin.py       LinkedIn company-page post
  post_whatsapp.py       WhatsApp Cloud API delivery (+ Channel note)
  requirements.txt
  out/                   generated captions + last_payload.json (committed for audit)
```

## Notes / guardrails
- Never invents a level: the model is instructed to verify every figure and tag `V`/`EST.`.
- Integrity checks abort the run if the disclaimer is missing or "Wealth Street" appears.
- A posting failure never blocks the deploy (posting steps are `continue-on-error`).
- The daily PDF is versioned in `public/` (`YYYY-MM-DD-Economic-Vibes-Morning-Brief.pdf`); the page links
  to today's file.
