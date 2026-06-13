# ContexAi Agents Team — Architectural Spec

**Status:** v1
**Owner:** Amir W. Ahmed, Founder & Creator
**Date:** 2026-05-25

This spec defines *how* the agents collaborate — the routing protocol, the delegation contract, the synthesis pattern, and the engagement lifecycle. The companion `contexai-org-chart.md` defines *who* is in the team and their reporting lines.

If you only have time to read one section, read **S3 The Delegation Protocol** — that's the core contract every agent in the team is built around.

---

## 1. Goals

The ContexAi Agents Team exists to turn a small founder-led consultancy into a high-leverage operation. The architectural goals are:

1. **Single front door.** Any consulting request that arrives — from Amir, from a client, from a Cowork session — has one entry point: the Group Chief of Staff. No "did I call the right agent?" guessing.

2. **Specialisation without silos.** Each SME holds deep domain knowledge but cannot operate in isolation — cross-practice deliverables (e.g. "Islamic REIT model with HAZOP-style risk register") are the rule, not the exception.

3. **Audit-ready outputs.** Every deliverable cites its source agents, its inputs, and its date. Anyone can reconstruct who did what and when.

4. **Replaceable parts.** Agents can be improved, retired, or swapped without rebuilding the team. The contract between Chief and Lead, and between Lead and SME, is what holds the system together — not the specific skill files.

## 2. Non-goals (v1)

- Autonomous client-facing delivery — humans still send every external email/document
- Agents writing to live systems (CRM, accounting, regulators) — read-only initially
- A scheduler that auto-triggers agents on calendar events — manual invocation for now
- Compensation/utilisation tracking for the human experts on the marketplace — separate project

## 3. The Delegation Protocol

Every agent-to-agent handoff in the ContexAi team follows the same five-field contract.

### 3.1 The five fields

When the Chief delegates to a Lead, or a Lead delegates to an SME, the prompt must contain:

| Field | Description | Example |
| --- | --- | --- |
| **Engagement** | Client + mandate identifier | "TSH Group / REIT structuring" |
| **Goal** | What good looks like, in one sentence | "Draft a Murabaha-compliant 7-year facility term sheet for a Karachi industrial project" |
| **Inputs** | Source materials available | "Client brief at /uploads/tsh-brief.pdf, Sponsor balance sheet, latest SBP IBD circulars" |
| **Deliverable** | Format + audience | "10-slide pitch deck for board review, Instrument Serif headings, no jargon over 2 levels deep" |
| **Deadline** | Time pressure (real or self-imposed) | "By Wednesday EOD, board pack assembly Thursday" |

Agents must refuse or query if any field is missing — incomplete delegation is the leading cause of bad output.

### 3.2 Why this matters

LLM agents fail predictably when:
- the goal is fuzzy ("look into X")
- the audience is unstated (boardroom vs. workshop)
- the format is implicit ("a doc" — Word? PDF? markdown?)
- the inputs are vague ("our usual files")

The five-field contract forces clarity before tokens get spent.

## 4. The Synthesis Pattern

When a Lead reports back to the Chief — or the Chief reports back to Amir — outputs follow a single template:

```
1. Headline (one sentence: what was done, what the answer is)
2. Inputs used (with file paths or links)
3. Decisions made (assumptions, exclusions, tradeoffs)
4. Deliverables (with file paths)
5. Open questions / risks
6. Recommended next step
```

Cross-practice work always synthesizes at the level above. If two practice leads contribute, the Chief writes the final synthesis. Two SMEs in one practice → the Lead synthesizes.

## 5. The Engagement Lifecycle

Every ContexAi engagement (whether internal-Amir or external-client) moves through six stages:

```
1. INTAKE      — Group Chief captures the five fields + opens engagement folder
2. SCOPING     — Lead(s) sketch the deliverable + flag dependencies/risks
3. KICK-OFF    — Amir signs off scope; SMEs assigned to workstreams
4. DELIVERY    — SMEs produce; Lead reviews; Document Controller files
5. REVIEW      — Chief + Lead do a quality pass against the brief
6. CLOSE       — Final deliverable + lessons-learned note
```

Stages 1, 5, and 6 are always run by the Group Chief. Stages 2–4 are owned by the relevant Practice Lead or Client Chief.

### 5.1 Intake protocol (Stage 1)

The Group Chief runs this every time a new engagement starts. It produces a one-page `engagement-brief.md` saved to the engagement folder. Template:

```
# Engagement Brief — <Client> / <Mandate>

- ID: ENG-2026-NNN
- Opened: <date>
- Sponsor (client side): <name + title>
- ContexAi lead: <Practice Lead or Client Chief skill>
- Goal: <one sentence>
- Deliverable: <format, audience, page count target>
- Deadline: <date>
- Fee structure: <if client engagement>
- Conflicts checked: <yes/no>
- Linked files: <paths>
- Folder: <OneDrive\01_Professional\AWA\ContexAi\Engagements\<client>\>
```

## 6. Memory & Document Conventions

A single naming convention across all agents so any deliverable can be located by anyone (including future-Amir).

### 6.1 Folder structure (lives in OneDrive)

```
AWA\ContexAi\Engagements\
  <client>\
    <ENG-2026-NNN>\
      00_brief\
      10_inputs\
      20_workstreams\
        <workstream-name>\
      30_drafts\
      40_final\
      50_lessons\
```

### 6.2 File naming

```
<ENG-ID>_<workstream>_<doc-type>_v<N>_<YYYY-MM-DD>.<ext>
```

Examples:
- `ENG-2026-007_islamic-finance_termsheet_v3_2026-05-20.docx`
- `ENG-2026-007_valuation_model_v1_2026-05-22.xlsx`

The `awa-agent` Document Controller enforces this — call it whenever you save.

## 7. Cross-Practice Coordination

When work touches two or more practices, the Group Chief is the orchestrator. The pattern:

```
Group Chief
├─ delegates "Islamic finance side" → Banking Practice Lead
│   └─ delegates to Islamic Banking SME → produces structure
└─ delegates "REIT side" → Real Estate Practice Lead
    └─ produces REIT term sheet + tax treatment

Group Chief synthesizes the two outputs into one client-facing memo.
```

The Practice Leads do NOT talk to each other directly. All cross-practice coordination flows through the Chief. This is by design — it prevents two Leads from independently making contradicting commitments to a client.

## 8. Tool & MCP Allocation

Some agents need specific MCP servers active to do their job. Document Controller (`awa-agent`) needs Google Drive / OneDrive. Document/deck/spreadsheet skills work without MCPs.

| Agent type | Required MCPs (typical) |
| --- | --- |
| Group Chief, Practice Leads | None — pure orchestration |
| Document Controller | Google Drive (or local filesystem) |
| Financial Modeling | None — produces xlsx files |
| Banking SMEs | Optional: connector to client core banking |
| Energy SMEs | Optional: web search for prices/news |
| Regulatory SMEs | Optional: SBP/SECP web search |

The Group Chief's skill description does not require any MCP — it's a routing brain, not a data-access agent.

## 9. Quality Gates

Every deliverable passes through quality gates before it leaves the team:

| Gate | Owner | What it checks |
| --- | --- | --- |
| **Brand** | Group Chief | On-brand voice, Instrument Serif + DM Sans, no claims we can't defend |
| **Technical** | Practice Lead | Domain accuracy, regulatory citations, math checks |
| **Format** | Document Controller | Naming convention, version stamp, signature blocks |
| **Audience** | Group Chief | Right length, right depth, right jargon level |

A deliverable that fails any gate goes back one stage. We never ship something that failed Brand or Technical.

## 10. Failure Modes & Recovery

| Failure | Symptom | Recovery |
| --- | --- | --- |
| Wrong practice routed | Lead can't answer or asks Amir to clarify | Chief re-routes; updates `org-chart.md` if the heuristic needs fixing |
| Two practices both deliver same workstream | Duplicate work, contradicting outputs | Chief enforces single-owner rule; deletes the duplicate |
| SME hallucinates a fact | Regulatory citation wrong, formula off | Practice Lead catches at Technical gate; sends back with citation request |
| Engagement loses thread mid-stream | Folder messy, no brief | Document Controller re-runs Intake retroactively |
| New domain appears that doesn't fit any practice | No clear Lead | Chief opens it as a "general consulting" workstream, escalates to Amir to decide whether to spin up a new Practice Lead |

## 11. Evolution

This spec is v1. The team will outgrow it. Indicators that a structural change is needed:

- A Practice Lead becomes a routing bottleneck → split into sub-practices (e.g., Banking → split Conventional and Islamic if both grow)
- A client team gets large enough → graduate from "uses Practice Leads" to "has its own Client Chief" (this is how SMFB earned its own plugin)
- Cross-practice deliverables outnumber single-practice → consider naming a "horizontal" Lead (e.g., a "Deal Lead" who runs IB-style processes regardless of practice)
- Two SMEs do overlapping work → merge or assign distinct scopes in `org-chart.md`

## 12. Open questions (v2 candidates)

- **Engagement registry as code.** Today engagements live in OneDrive + a JSON file in R2. Should there be a proper Engagement Service inside the Worker, with state transitions, audit log, and a UI in the dashboard?
- **Public marketplace integration.** When the 7 founding experts on contexai.org take on work, do they activate as agent-equivalents (with their own SKILL.md files)? Or do they stay human-only?
- **External agents from clients.** Cnergyico might give us their own agents one day. The protocol for "trusting" an external agent and routing to it needs definition.
- **Compensation / utilisation tracking.** Once the marketplace handles real engagements, the dashboard needs hooks to log who delivered what.

---

**The minimum viable behaviour for v1:**

1. Any "ContexAi" ask triggers the Group Chief (`contexai-group-chief` skill)
2. The Group Chief classifies, picks a Practice Lead or Client Chief, runs intake if needed, and delegates with all five fields
3. The Practice Lead or SME delivers in the standard synthesis template
4. The Chief reviews against the brief, applies the quality gates, hands to Amir
5. Document Controller files everything

If we can do that loop consistently across two practices for a week, v1 is working.
