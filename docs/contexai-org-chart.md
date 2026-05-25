# ContexAi Group — Organisation Chart

**Status:** v1 baseline
**Owner:** Amir W. Ahmed, Founder & Creator
**Date:** 2026-05-25

This document is the canonical map of every agent in the ContexAi Group, their reporting line, and their domain of authority. If a new agent or skill is added, this chart updates with it. If two agents look like they do the same thing, this chart resolves the ambiguity.

The structure follows a single rule: **one Chief, many Practice Leads, many SMEs**. Anything cross-practice flows through the Chief. Anything single-domain can go direct to the Lead or SME.

---

## 1. The chart at a glance

```
                              ┌──────────────────────────┐
                              │  Amir W. Ahmed           │
                              │  Founder & Creator       │
                              │  (Human-in-the-loop)     │
                              └──────────────┬───────────┘
                                             │
                              ┌──────────────▼───────────┐
                              │  ContexAi Group Chief    │
                              │  of Staff                │   ← contexai-group-chief
                              │  (Top orchestrator)      │
                              └──┬───────┬───────┬───────┘
                                 │       │       │
        ┌────────────────────────┘       │       └─────────────────────────┐
        │                                │                                 │
        │                                │                                 │
┌───────▼──────────┐         ┌───────────▼─────────┐            ┌──────────▼─────────┐
│  PRACTICE LEADS  │         │  CLIENT TEAMS       │            │  SHARED SERVICES   │
│  (by domain)     │         │  (by account)       │            │  (cross-domain)    │
└───────┬──────────┘         └───────────┬─────────┘            └──────────┬─────────┘
        │                                │                                 │
        ├─ Banking & Financial Services  ├─ SMFB Agents Team               ├─ Document Controller
        │  (banking-practice-lead →      │  (smfb-chief-of-staff           │  (awa-agent)
        │   banking-advisory plugin)     │   from smfb plugin)             │
        │                                │                                 ├─ Financial Modeling
        ├─ Energy & Petrochemicals       ├─ TSH Agents Team                │  (smfb-financial-expert,
        │  (energy-petrochem-lead)     │  (future)                       │   xlsx)
        │                                │                                 │
        ├─ Real Estate & Infrastructure  ├─ Cnergyico Agents Team          ├─ Decks & Documents
        │  (reit-practice-lead)          │  (future)                       │  (pptx, docx, pdf)
        │                                │                                 │
        ├─ Professional Bodies &         └─ (other future clients)         ├─ Core Banking Systems
        │  Accreditation                                                   │  (pibas-expert)
        │  (accreditation-practice-lead) │                                 │
        │                                                                  ├─ Regulatory & Legal
        └─ (future: Public Sector,                                         │  (legal-corporate-secretary,
            Healthcare, Education...)                                      │   contexai-regulatory-pakistan)
                                                                           │
                                                                           └─ Brand & Comms
                                                                              (brand-guidelines,
                                                                               internal-comms,
                                                                               canvas-design)
```

## 2. Roles in detail

### 2.1 ContexAi Group Chief of Staff
**Skill:** `contexai-group-chief`
**Role:** Top-level orchestrator for any ContexAi engagement. First point of contact when a request is cross-practice, when the practice isn't obvious, when a new client is onboarded, or when Amir says "ContexAi" without specifying a domain.

**Triggers on:** "ContexAi engagement", "new mandate", "I have a client", "build me a proposal", "draft the SOW", "where do I start", "kick off", any cross-domain ask, any consultancy-wide question.

**Does NOT do:** the actual delivery work. It delegates to Practice Leads and synthesizes back.

### 2.2 Practice Leads

Each Practice has a dedicated **Practice Lead** skill (built specifically for ContexAi Group routing) that sits above the underlying SMEs and any pre-existing plugin.

| Practice | Practice Lead skill | Sits above | When to trigger |
| --- | --- | --- | --- |
| **Banking & Financial Services** | `banking-practice-lead` | `contexai-chief-of-staff` (banking-advisory plugin) → 3 Domain Leads → 9 SMEs | Anything banking, financial sector, SBP/SECP, regulatory, financial-services strategy |
| **Energy & Petrochemicals** | `energy-petrochem-lead` | `margin-architect`, `alchemist`, `sentinel`, `constructor`, `trader` | Refinery margins, crude slate, FCC/coker, HAZOP, EPC project, oil trading, downstream marketing |
| **Real Estate & Infrastructure** | `reit-practice-lead` | `reit-advisory-lead`, `legal-corporate-secretary` | REIT structuring, IM/Board Deck for RE deals, stamp duty, ITO §99, TSH project work |
| **Professional Bodies & Accreditation** | `accreditation-practice-lead` | `cip-master-plan`, `cip-corporate-secp`, `cip-ip-academic`, `cip-regulatory-strategy` | CIP, CCP designation, Section 42 NPO for institutes, HEC accreditation strategy |

The Practice Lead pattern is uniform — every Lead follows the same five-field delegation contract and synthesis template. See `docs/contexai-agents-team-spec.md` for the architectural pattern.

### 2.3 Client-Specific Teams

A "Client Team" activates when the work is FOR a specific named client AND that client has its own multi-agent plugin already built. Distinct from a Practice Lead, which is domain-scoped.

| Client | Chief skill | Status |
| --- | --- | --- |
| **Sindh Microfinance Bank** | `smfb-chief-of-staff` (smfb-agents-team plugin) | Live |
| TSH Group | (future) | Currently handled by `reit-advisory-lead` + `legal-corporate-secretary` |
| Cnergyico | (future) | Currently handled by `energy-petrochem-lead` |

When client and practice both fit, **client team wins**. Reason: client teams hold institutional memory (system bindings, regulatory context, named contacts) that practice leads don't.

### 2.4 Shared Services

Available to all practices and client teams. Called as needed during delivery.

| Service | Skill | Purpose |
| --- | --- | --- |
| Document Controller | `awa-agent` | Engagement folder setup, file naming, version control, archival |
| Financial Modeling | `smfb-financial-expert`, `xlsx` | Three-statement models, BOD packs, financial statements, valuations |
| Decks & Presentations | `pptx` | Board decks, pitch books, IM presentations |
| Word Documents | `docx` | Formal letters, memos, MoA/AoA, contracts |
| PDF Operations | `pdf` | Merging, splitting, form filling, OCR |
| Core Banking Systems | `pibas-expert` | PIBAS reports, banking automation, regulatory returns |
| Regulatory & Legal (Pakistan) | `legal-corporate-secretary`, `contexai-regulatory-pakistan` | Board resolutions, SECP filings, corporate governance |
| Brand & Communications | `brand-guidelines`, `internal-comms`, `canvas-design` | On-brand outputs, comms drafting, visual assets |

### 2.5 The SME bench under each Practice Lead

**Banking & Financial Services** (via `contexai-chief-of-staff`):
- Banking Ops Lead → Conventional, Islamic, Microfinance, PIBAS SMEs
- Capital Markets Lead → Investment Banking, Private Equity
- Innovation Lead → Blockchain, Fintech, Startups
- Cross-cutting → Regulatory Pakistan, Document Controller, Financial Modeling

**Energy & Petrochemicals** (via `energy-petrochem-lead`):
- Refining Economics → `margin-architect` (LP modeling, crack spreads, netbacks)
- Petrochem Value Chain → `alchemist` (cracker, polyolefins, BTX, MTO)
- Asset Integrity & Reliability → `sentinel` (API 510/570/653, RBI, HAZOP, RCA)
- Capital Projects → `constructor` (EPC, FEED, FIDIC, schedule/cost)
- Trading & Marketing → `trader` (Brent/WTI/Dubai, freight, retail, bunkers)

**Real Estate & Infrastructure** (via `reit-advisory-lead`):
- Corporate Secretary → `legal-corporate-secretary` (board resolutions, SECP filings)
- (future) SPV/JV structuring SME, Real Estate Valuations SME

**Professional Bodies & Accreditation** (via `cip-master-plan`):
- Corporate Architecture → `cip-corporate-secp` (Section 42, MoA/AoA, board)
- IP & Academic Strategy → `cip-ip-academic` (IPO-Pakistan, HEC, designation IP)
- Regulatory Engagement → `cip-regulatory-strategy` (SBP/PBA endorsement)

## 3. Routing matrix

This is the heuristic the Group Chief uses when an ask comes in.

| Signal in the request | Route to |
| --- | --- |
| Names a specific client with a client team | Client Chief (e.g., `smfb-chief-of-staff` for SMFB) |
| Mentions Murabaha, Sukuk, Islamic banking, IBI | `banking-practice-lead` → banking-advisory plugin |
| Mentions IPO, M&A, valuation, fund formation | `banking-practice-lead` → Capital Markets domain |
| Mentions tokenisation, RAAST, EMI, neobank | `banking-practice-lead` → Innovation domain |
| Mentions REIT, real estate, TSH, stamp duty, ITO §99 | `reit-practice-lead` |
| Mentions SPV / JV structuring, RUDA, DHA, Bahria | `reit-practice-lead` |
| Mentions refinery, crude, FCC, BTX | `energy-petrochem-lead` |
| Mentions HAZOP, mechanical integrity, RBI | `energy-petrochem-lead` → Sentinel |
| Mentions EPC, FEED, project schedule | `energy-petrochem-lead` → Constructor |
| Mentions Brent, WTI, Dubai, freight, bunkers | `energy-petrochem-lead` → Trader |
| Mentions CIP, CCP, designation, professional body | `accreditation-practice-lead` |
| Mentions Section 42 NPO, HEC accreditation, IPO-Pakistan trademark | `accreditation-practice-lead` |
| Mentions PIBAS, core banking, EOD | `pibas-expert` (under banking practice context) |
| Asks to "organise files", "where did I put X" | `awa-agent` |
| Asks to build a model | `smfb-financial-expert` or `xlsx` |
| Cross-practice or unclear | Group Chief picks 2+ practice leads, synthesizes |
| New engagement, no practice clear | Group Chief runs intake protocol |

## 4. Versioning

When the chart changes:
1. Update this file
2. Update `docs/contexai-agents-team-spec.md` if the architecture pattern itself changed
3. Update the Chief's SKILL.md if the routing rules changed
4. Commit with a clear message: `docs(org): add <new agent>` or `docs(org): retire <old agent>`

If you ever wonder "who handles X?", this doc is the source of truth — not the conversation in your head.
