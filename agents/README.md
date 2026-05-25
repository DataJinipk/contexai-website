# ContexAi Agents

This folder is the canonical, version-controlled home for every agent skill defined for the ContexAi consulting marketplace. The skills here run inside Claude Code / Cowork sessions; this folder is the source of truth.

If you're trying to **understand the team**, start with `docs/contexai-org-chart.md` in the repo root.

If you're trying to **understand the architecture**, read `docs/contexai-agents-team-spec.md`.

If you just want to **install the skills locally**, run `install.ps1` from this folder.

---

## What lives here

Each subfolder is one skill. A skill is a folder containing a `SKILL.md` file with YAML frontmatter (`name`, `description`) plus the body that becomes the agent's system prompt when triggered.

```
agents/
├── README.md                       ← you are here
├── install.ps1                     ← copies skills into ~/AppData/.../skills/
├── contexai-group-chief/
│   └── SKILL.md                    ← Top-level orchestrator (the Chief)
├── banking-practice-lead/
│   └── SKILL.md                    ← Banking & Financial Services Lead (thin wrapper over banking-advisory plugin)
├── energy-petrochem-lead/
│   └── SKILL.md                    ← Energy & Petrochemicals Lead
├── reit-practice-lead/
│   └── SKILL.md                    ← Real Estate & Infrastructure Lead
└── accreditation-practice-lead/
    └── SKILL.md                    ← Professional Bodies & Accreditation Lead
```

**Five skills in this folder:** one Chief + four Practice Leads, one per ContexAi practice. Together they give the Group a single front door and uniform delegation pattern. The deep SME work continues to live in pre-existing skills and plugins — see the next section.

## Agents NOT in this folder

Several agents in the ContexAi org chart live elsewhere because they pre-date this folder or live in separate plugins. They're still part of the team — this folder simply doesn't duplicate them.

| Agent | Lives in | Why |
| --- | --- | --- |
| `contexai-chief-of-staff` (Banking) | `contexai-banking-advisory` plugin | Pre-existing, comprehensive plugin |
| `smfb-chief-of-staff` (SMFB) | `smfb-agents-team` plugin | Client-specific team in its own plugin |
| `alchemist`, `sentinel`, `constructor`, `trader`, `margin-architect` | Personal skills folder | Pre-existing standalone SMEs |
| `reit-advisory-lead`, `legal-corporate-secretary` | Personal skills folder | Pre-existing (and powerful) |
| `cip-master-plan`, `cip-corporate-secp`, `cip-ip-academic`, `cip-regulatory-strategy` | Personal skills folder | Pre-existing CIP suite |
| `pibas-expert`, `smfb-financial-expert`, `awa-agent` | Personal skills folder | Pre-existing shared services |

The agents in THIS folder are the **new orchestration layer** — Group Chief and Practice Leads — that sit above and route between the pre-existing skills.

## Installing the skills

The personal skills folder Claude reads from is:

```
%APPDATA%\Claude\local-agent-mode-sessions\skills-plugin\<plugin-id>\<session-id>\skills\
```

For Amir's installation, that resolves to:

```
C:\Users\amirw\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\c8bb6892-a9e7-48cc-891a-c252e53ed731\74339304-8da4-4e69-9fe4-ab74f4e3246f\skills\
```

To install:

```powershell
cd C:\Users\amirw\contexai-website\agents
.\install.ps1
```

The script copies each skill subfolder into the personal skills folder, preserving structure. Existing copies are overwritten — the canonical source is here, not there.

To verify after install, open a new Cowork or Claude Code session and ask:

> Group Chief, classify this engagement: TSH wants a REIT structuring memo.

If the Group Chief responds in character, the install worked.

## Authoring new agents

Same pattern every time:

1. Create a new folder under `agents/` named after the skill (kebab-case).
2. Add a `SKILL.md` with the YAML frontmatter — `name` and `description` are required, and the description matters: it's what Claude reads to decide whether to trigger the skill. Make it specific. Include example phrases that should trigger it.
3. Write the body as the system prompt. Keep it under ~500 lines if possible (progressive-disclosure principle from the skill-creator).
4. Run `install.ps1` to deploy.
5. Test by talking to the agent in a fresh session.
6. Commit: `git add agents/<new-skill> && git commit -m "feat(agents): add <new-skill>"`

If a new skill needs a Practice Lead spot or changes routing, update `docs/contexai-org-chart.md` and the routing matrix in `contexai-group-chief/SKILL.md`.

## Skill description style guide

The `description` field is what makes triggering work. Patterns we use:

- **Start with the role:** "Practice Lead for X" or "Subject Matter Expert in Y"
- **Then specifically when to trigger:** "Use whenever the user mentions ..." with concrete phrases
- **Then the team relationship:** "Reports to ..." or "Routes between ..."
- **Never be vague.** "Helps with consulting" → useless. "Helps with REIT structuring under SECP REIT Regulations 2015 and Pakistan Income Tax Ordinance § 99A" → useful.

Bad:

```yaml
description: Real estate consulting agent.
```

Good:

```yaml
description: Practice Lead for the Real Estate & Infrastructure practice at ContexAi. Use whenever a request involves REIT structuring, SECP REIT Regulations 2015, Pakistani real estate tax (ITO § 99 / § 99A), TSH Group mandates, SPV / JV structuring, RUDA, stamp duty, CGT on RE, or any real estate advisory work. Routes between reit-advisory-lead and legal-corporate-secretary; reports to contexai-group-chief.
```

## Versioning

Skills are version-controlled by git alongside the rest of the site. Significant changes to a skill warrant a commit message like `feat(agents/cnergyico-lead): add chemical-recycling routing`. Retiring a skill: `git rm` it from this folder, but document the retirement in the org chart.
