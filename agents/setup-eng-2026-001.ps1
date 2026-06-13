# setup-eng-2026-001.ps1
# One-shot setup for the TSH Islamic REIT engagement (ENG-2026-001).
#
# Creates the canonical engagement folder structure under OneDrive,
# drops the brief and intake agenda into 00_brief/, and opens File Explorer.
#
# Usage:
#   1. Save this script anywhere (e.g., Downloads).
#   2. Right-click → Run with PowerShell  (or:  .\setup-eng-2026-001.ps1 in a PowerShell window)
#
# Safe to re-run — existing files are overwritten with the canonical versions.

$ErrorActionPreference = "Stop"

# ─── Paths ───────────────────────────────────────────────────────────────────
$base   = "$env:USERPROFILE\OneDrive\01_Professional\AWA\ContexAi\Engagements\TSH\ENG-2026-001"
$brief  = "$base\00_brief\ENG-2026-001_engagement-brief_v1_2026-05-26.md"
$agenda = "$base\00_brief\ENG-2026-001_intake_agenda_v1_2026-05-26.md"

# ─── 1. Create engagement folder structure ───────────────────────────────────
$subfolders = @(
    "00_brief",         # intake docs, scope, fee letter
    "10_inputs",        # client-supplied source files
    "20_workstreams",   # working folders per Practice Lead stream
    "30_drafts",        # in-progress deliverables
    "40_final",         # client-released deliverables
    "50_lessons"        # post-engagement lessons-learned
)

Write-Host "Creating engagement folder structure..." -ForegroundColor Cyan
foreach ($s in $subfolders) {
    $path = Join-Path $base $s
    New-Item -ItemType Directory -Force -Path $path | Out-Null
    Write-Host "  ✓ $s" -ForegroundColor Green
}

# Also create Practice Lead workstream subfolders
$workstreams = @("banking-shariah-structure", "reit-tax-structure")
foreach ($w in $workstreams) {
    $path = Join-Path "$base\20_workstreams" $w
    New-Item -ItemType Directory -Force -Path $path | Out-Null
    Write-Host "  ✓ 20_workstreams\$w" -ForegroundColor Green
}

# ─── 2. Write the engagement brief ───────────────────────────────────────────
$briefContent = @'
# Engagement Brief — TSH Group / Islamic REIT

| Field | Value |
| --- | --- |
| **ID** | ENG-2026-001 |
| **Opened** | 2026-05-26 |
| **Mandate** | Structure a Shariah-compliant REIT vehicle for the TSH Group |
| **Sponsor (client side)** | [TBD — confirm: Director or Chairman of TSH] |
| **ContexAi lead** | Group Chief (cross-practice — Banking + Real Estate) |
| **Practice Leads engaged** | `banking-practice-lead` + `reit-practice-lead` |
| **Goal** | Decide the optimal Shariah-compliant REIT structure for TSH''s portfolio and deliver a memo, term sheet, and sponsor board deck sufficient to authorise the next phase (SECP filing or PSX roadmap). |
| **Deliverables** | (1) Structuring memo — 5 pages, decision-grade. (2) Indicative term sheet — 1 page. (3) Sponsor board deck — 10 slides, Instrument Serif + DM Sans. |
| **Deadline** | [TBD — recommend 4 weeks from kick-off] |
| **Fee structure** | [TBD — recommend fixed fee on Phase 1 (memo + term sheet) + monthly retainer through SECP filing] |
| **Conflicts checked** | No conflicting Islamic-finance or REIT mandates in flight. |
| **Engagement folder** | This folder. |

## Cross-practice routing plan

Two streams run in parallel; Group Chief synthesizes.

**Stream A — Shariah structure** (`banking-practice-lead` → banking-advisory plugin → Banking Ops Lead → Islamic Banking SME)
- Asset-level contract choice: Ijarah (lease-based) vs Diminishing Musharakah (gradual ownership) vs Murabaha (cost-plus) — likely Ijarah for income real estate, but lock with rationale.
- Income purification & Shariah governance: scholar board engagement plan, AAOIFI Standard No. 21 alignment.
- Profit-rate model: floor / cap, KIBOR linkage if any, sub-period reset mechanics.
- Investor disclosure standards for Shariah compliance (AAOIFI Statement 1).
- Workstream folder: `20_workstreams\banking-shariah-structure\`

**Stream B — REIT structure & tax** (`reit-practice-lead` → `reit-advisory-lead` + `legal-corporate-secretary`)
- **First decision (locked Day 1):** Rental REIT (passive, ITO S 99A pass-through, 90% distribution) vs Hybrid REIT (development + rental, ITO S 100 treatment).
- SECP REIT Regulations 2015 (with 2022 amendments) compliance path: scheme registration, RMC fit-and-proper, trustee appointment.
- Pakistani tax treatment: stamp duty on transfers, CVT, CGT exemptions under S 99A, withholding implications for distributions.
- PSX listing pathway (if in scope): scheme approval → IPO prospectus → listing.
- Workstream folder: `20_workstreams\reit-tax-structure\`

**Synthesis** (Group Chief)
- Combine A + B into a single structuring memo: "TSH Islamic REIT — Recommended Structure"
- Reconcile any tension between Shariah requirements and SECP REIT Regs (e.g., 90% distribution requirement vs Shariah purification — generally compatible but cite).
- Brand-consistent board deck for sponsor review.
- Final deliverables go to `40_final\`.

## Open questions for sponsor before kick-off

1. **Sponsor at TSH** — who is the authorising contact (Director / Chairman) and who is the day-to-day point of contact?
2. **Portfolio scope** — which TSH assets enter the REIT? Industrial only (Three Stars Hosiery / sister entities) or mixed including any commercial / development land?
3. **Capital target** — indicative REIT size (PKR billions)?
4. **REIT type preference** — Rental (passive, max tax pass-through) or Hybrid (room for development gains)?
5. **Shariah scholar / board** — does TSH have a preferred Shariah Supervisory Board (SSB) or scholar, or shall ContexAi propose options (Mufti Muhammad Taqi Usmani''s tradition or Meezan-aligned scholars)?
6. **Listing intent** — PSX listing in Phase 1, or private placement first then list later?
7. **Deadline / sponsor board date** — when is the sponsor decision needed?
8. **Fee structure** — fixed fee preference or willing to retain through SECP filing?

## Conflicts check

- No live Islamic-banking mandate that would conflict.
- No live REIT mandate (TSH is the anchor REIT client).
- No relationship with TSH''s potential trustee candidates (Pak Brunei Investment Company, Habib Asset Management, etc.) that would create independence risk.

## Recommended next step

30-minute intake call with the TSH sponsor (proposed within 48 hours) to lock the eight open questions above. Group Chief drafts a one-page meeting agenda for the call on confirmation, and briefs both Practice Leads same-day with the completed five-field contract.

---

**Brief status:** DRAFT pending sponsor confirmation.
**Author:** ContexAi Group Chief of Staff
**Approver:** Amir W. Ahmed, Founder & Creator
'@

$briefContent | Out-File -FilePath $brief -Encoding utf8 -Force
Write-Host "  ✓ Brief written: $brief" -ForegroundColor Green

# ─── 3. Write the intake agenda ──────────────────────────────────────────────
$agendaContent = @'
# Intake Call Agenda — TSH Islamic REIT

| | |
| --- | --- |
| **Engagement** | ENG-2026-001 — TSH Group / Islamic REIT |
| **Date** | [TBD — proposing within 48 hours] |
| **Duration** | 30 minutes |
| **From ContexAi** | Amir W. Ahmed (Founder & Creator), Group Chief of Staff |
| **From TSH** | [Sponsor + 1 day-to-day contact] |
| **Pre-read** | `ENG-2026-001_engagement-brief_v1_2026-05-26.md` (sent 24 hours ahead) |
| **Objective** | Lock the 8 open questions in the intake brief so ContexAi can kick off two parallel workstreams (Shariah structure + REIT structuring) the same day |

---

## Run sheet

### 0:00 — 0:03  ·  Welcome & frame (3 min)
- Brief intro from Amir.
- Group Chief states the goal: leave with the eight open questions answered so work starts immediately.
- Confirm that the call is for scoping, not yet for decisions on specific REIT terms.

### 0:03 — 0:08  ·  TSH''s strategic "why" (5 min) — *sponsor talks*
- What is TSH trying to unlock with this REIT — capital release from existing assets, vehicle for new investors, succession planning, or a step on the path to PSX listing?
- The "why" disciplines every subsequent decision; we listen rather than steer here.

### 0:08 — 0:13  ·  Portfolio scope (5 min) — **Question 2**
- Which TSH assets enter the REIT? Industrial (Three Stars Hosiery and sister entities) only, or a mixed portfolio including commercial or development land?
- Indicative asset list, even if rough — names, locations, approximate values.
- Any assets explicitly out of scope (e.g., family-residential, legacy operating sites)?

### 0:13 — 0:18  ·  REIT type & capital target (5 min) — **Questions 3 & 4**
- Capital target — indicative REIT size in PKR billions.
- Preferred REIT type:
  - **Rental REIT** — passive income, 90% distribution requirement, full ITO S 99A pass-through tax treatment.
  - **Hybrid REIT** — allows development gains, broader scope, taxed under ITO S 100 on development components.
- Group Chief flags trade-offs only; recommendation comes back in the structuring memo, not on the call.

### 0:18 — 0:22  ·  Shariah governance (4 min) — **Question 5**
- Does TSH have a preferred Shariah Supervisory Board / scholar, or shall ContexAi propose 2–3 options (Mufti Muhammad Taqi Usmani''s tradition, Meezan-aligned scholars, or independent SSBs)?
- Any Shariah constraints already known (e.g., AAOIFI Standard 21 alignment commitment, restrictions on conventional banking counterparties for any debt component)?

### 0:22 — 0:26  ·  Listing intent & timeline (4 min) — **Questions 6 & 7**
- PSX listing in Phase 1, private placement first then list, or private only at v1?
- Sponsor board decision date — when does TSH need the structuring memo + board deck?
- Any external deadlines (regulatory windows, investor commitments, audit cycle)?

### 0:26 — 0:30  ·  Engagement model & close (4 min) — **Questions 1 & 8**
- **Sponsor & day-to-day contact** — formally confirm both, plus preferred channel (email / WhatsApp / scheduled calls).
- **Fee structure preference** — fixed fee on Phase 1 + retainer through SECP filing is the ContexAi proposal; willing to discuss.
- Group Chief states the next 48 hours:
  - Brief moves to `OneDrive\01_Professional\AWA\ContexAi\Engagements\TSH\ENG-2026-001\`
  - Banking and Real Estate Practice Leads briefed same-day
  - First deliverable (structuring memo Draft 1) committed for [Day +14]

---

## What the sponsor should bring

- A rough asset list with locations and indicative book / market values.
- A view on whether this REIT is primarily an **investor vehicle** (raising third-party capital) or a **family-office vehicle** (rationalising existing holdings).
- Any preferred Shariah scholar or any prior Islamic-finance partner whose continuity matters.
- A target sponsor-board date.

## What ContexAi commits to

- Send the intake brief 24 hours before the call so the sponsor reads it cold.
- Keep the call to 30 minutes — strict timekeeping.
- Within 24 hours of the call: send a **completed intake brief** with all 8 answers filled in, the engagement folder set up, and confirmation of when the structuring memo draft will land.

---

## Group Chief''s note on tone

This is a scoping call, not a sales call. Don''t pitch the REIT structure on the call — pitch comes later in the structuring memo. The job here is to listen long enough on the "why" that the eventual recommendation lands as obvious, not surprising.

---

**Draft status:** v1 — ready to send once date/time confirmed.
**Author:** ContexAi Group Chief of Staff
**Approver:** Amir W. Ahmed, Founder & Creator
**Distribution on confirmation:** TSH sponsor + nominated day-to-day contact (with the intake brief attached).
'@

$agendaContent | Out-File -FilePath $agenda -Encoding utf8 -Force
Write-Host "  ✓ Agenda written: $agenda" -ForegroundColor Green

# ─── 4. Done — open the folder ───────────────────────────────────────────────
Write-Host ""
Write-Host "Done. Folder structure created at:" -ForegroundColor Cyan
Write-Host "  $base" -ForegroundColor Yellow
Write-Host ""
Write-Host "Opening in File Explorer..." -ForegroundColor Cyan
Start-Process explorer.exe -ArgumentList $base
