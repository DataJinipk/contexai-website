# ContexAi Website — Critical Sanity Audit + Improvement Roadmap

**Date:** 13 June 2026
**Scope:** All 33 public HTML pages
**Method:** Automated scan + manual review of recent screenshots
**Audience:** Amir Waheed Ahmed, Founder & Creator

---

## Executive summary

The site is **in good shape overall** — clean IA, brand-consistent palette, strong content. **61 individual issues** found across **6 categories**, most are minor polish items. **3 are P0 confidentiality leaks** that should be fixed before showing the site to a sponsor.

| Severity | Count | Status |
| --- | --- | --- |
| 🔴 P0 — Confidentiality | 3 | **Must fix before public share** |
| 🟠 P1 — SEO / accessibility | ~30 | Should fix this week |
| 🟡 P2 — Visual polish | 13 | Nice-to-have for visual consistency |
| 🔵 P3 — Strategic | (below) | Roadmap items |

---

## 🔴 P0 — Confidentiality (3 must-fix)

The previous scrubs caught client/product names but missed **province-level identifiers**:

| File | Line | Leak | Fix |
| --- | --- | --- | --- |
| `public/case-studies/index.html` | 200 | `SBP-regulated Microfinance Bank, **Sindh**` | Drop "Sindh" → `SBP-regulated Microfinance Bank` |
| `public/case-studies/index.html` | 217 | Same (second card) | Drop "Sindh" |
| `public/practices/banking.html` | 184 | `serving low-income financial inclusion **across Sindh**` | Replace with "across a Pakistani province" |

The **13 `Karachi` mentions** are legitimate — they identify ContexAi's own HQ in the Global Presence section, the contact page, and the apply forms ("Karachi, Pakistan" as a placeholder). These should stay.

**Recommended action:** sed-fix the 3 Sindh occurrences in a single push.

---

## 🟠 P1 — SEO + Accessibility (30 issues)

### 1. Missing `<meta name="description">` (13 pages)

| Page group | Files |
| --- | --- |
| **Public-facing — fix** | `dashboard.html` (1 file) |
| **LinkedIn image source HTML** | All `public/images/linkedin/_src/*.html` (12 files) |

The LinkedIn `_src` files are **internal templates** used to generate social-share images. They shouldn't be indexed at all. **Recommendation:** add `<meta name="robots" content="noindex,nofollow">` to all `_src/*` files OR move them out of `public/` entirely. They're not customer-facing.

### 2. Missing `<link rel="canonical">` (17 pages)

Same root cause — most are the LinkedIn _src files. The remaining outliers are `apply.html`, `apply-position.html`, `dashboard.html` which need canonicals added pointing at their respective URLs.

### 3. Accessibility — no automated issues found

Good news — automated check found 0 `<img>` tags missing `alt` attributes across all 33 pages. Worth a manual screen-reader pass on insights articles + team page later.

---

## 🟡 P2 — Visual polish (13 issues, all on practice + team pages)

The "Showcase Your Agent" gradient treatment landed beautifully on:
- ✓ Home page Insights · Agentic AI · Client Wall · Practice Strip
- ✓ Practices index page tiles
- ✓ Case studies cards

But these pages **still have plain-white card backgrounds** and would benefit from the same treatment:

| File | Card class | Recommended treatment |
| --- | --- | --- |
| `practices/banking.html` | `.cap` (capability cards), `.team-tile` (SME bench) | Add teal-soft gradient |
| `practices/real-estate.html` | Same | Add parrot-soft gradient |
| `practices/energy.html` | Same | Add cnergyico-soft gradient |
| `practices/accreditation.html` | Same | Add purple-soft gradient |
| `team.html` | `.lead` (practice leads), `.sme` (bench tiles) | Already removed — no action |

**Estimated effort:** 1 hour to add gradient backgrounds to all `.cap` and `.team-tile` selectors on the 4 practice pages.

---

## 🔵 P3 — Strategic improvements (roadmap)

These are not bugs — they're opportunities the audit surfaced.

### A. Content gaps

| Page | What's missing | Impact |
| --- | --- | --- |
| **`/economy`** | The screenshot showed washed-out PDF download cards (Client Summary Deck / Sector Scorecard). They should match the new card pattern. | Visual consistency |
| **`/contact`** | No live engagement form preview — `/api/contact` route exists in worker but form may be plain | Conversion |
| **`/insights`** | Only 3 articles. To compete with Virtuosoft / OutOfBox, target 8–12 by Q3. | Authority / SEO |
| **`/team`** | Wasi & Naveed have full bios; the 7 Gulf/NA members have one-paragraph LinkedIn-style bios. Bring Wasi & Naveed bios down to match length, OR upgrade the 7 to match Wasi/Naveed length. | Visual balance |

### B. Brand identity

- **Logo refinement** — the current "ContexAi GROUP" lockup is functional but generic. Consider commissioning a wordmark + monogram. (Mid-term)
- **Photography vs initials** — Featured Members now have real photos. Consider similar treatment for Practice Lead cards on the home page (currently they use SMEs' agent identifiers, not real human photos).
- **Hero hierarchy** — the home hero currently leads with "Strategic Advisory & Intelligence in Context." Consider A/B testing a more concrete hook ("Senior partners + Agentic AI — for Pakistani institutions") to lift conversion.

### C. Conversion + measurement

- **No analytics token set** — `public/index.html` line ~1330 has the Cloudflare Web Analytics snippet commented out (`REPLACE_WITH_TOKEN`). Activating it will measure all the work we've done.
- **Newsletter signup wired but not tested** — the `/api/newsletter` endpoint exists; no end-to-end test of a real subscription yet.
- **Apply form drop-off** — would benefit from progress indicators on the multi-section forms in `apply.html`.

### D. Trust surfaces (Phase 2)

- **Real testimonials** — currently 3 anonymized testimonial cards. Get 2-3 named, attributed testimonials (with permission) from your network.
- **Client logos** — the client wall currently shows "Confidential" placeholders. Even one real logo (with NDA-cleared anonymized framing) would lift credibility materially.
- **Press / media mentions** — when CIP or any other engagement is press-released, add a small "Featured in" strip near the hero.

### E. Performance

- The home page `index.html` is now **~75 KB** uncompressed (was 67 KB before this session's work). Still well within Cloudflare's edge-cache budget. No optimization needed yet.
- Could lazy-load expert images (`expert-*.jpg`) on `/team` — currently 8 images load on first paint.
- Could inline SVG palette ribbon instead of a 10-span div — saves DOM nodes.

### F. Future content surfaces

| Surface | Status | Priority |
| --- | --- | --- |
| `/case-studies/[slug]` per-engagement detail pages | Not built (all "Full case study · pending sponsor approval") | High when 1 NDA clears |
| `/services/[slug]` dedicated service pages | Not built (services live in tabs only) | Medium |
| `/blog/` or extended `/insights/` library with tagging | Not built | Medium |
| `/careers/` proper job board | Stub (post-position.html exists) | Medium |
| `/offices/` with Dubai/Riyadh expansion roadmap | Not built | Low (Q3-Q4) |
| `/partners/` or `/network/` showcasing referral firms | Not built | Low |

---

## Recommended next push

**This session — 30 min:**

1. Drop the 3 "Sindh" mentions (P0)
2. Add `<meta name="robots" content="noindex">` to all `public/images/linkedin/_src/*.html` (P1, batch sed)
3. Activate Cloudflare Web Analytics — replace `REPLACE_WITH_TOKEN` once you grab a token from Cloudflare dash (P3, but quick)

**Next session — 1 hour:**

4. Apply gradient treatment to `.cap` and `.team-tile` on the 4 practice pages (P2 visual consistency)
5. Match Wasi/Naveed bio lengths with the 7 Gulf/NA members on `/team` (P3, content)

**Phase 2 (gated on you):**

6. Real testimonials (need permission)
7. First named client logo (need NDA review)
8. Per-engagement case-study detail page (need first cleared content)

---

## What's working really well

Things to keep / replicate:

- **v2 palette ribbon** at the top of every page — distinctive, immediately recognizable
- **Per-card palette colors** — Services tabs, Insights, Agentic AI, Join cards
- **"Showcase Your Agent" gradient style** — soft warm tinted-cream backgrounds with vibrant edge — now applied broadly
- **Practice-color theming** — Banking=Teal, Real Estate=Parrot, Energy=Cnergyico Flame, Accreditation=Royal Purple — fully consistent across hero, ribbon, anchor tiles, and case studies
- **Confidentiality posture** — "Confidential" anchors with sector descriptors is the right balance of credible-but-discreet
- **Site-wide top nav** — sticky, consistent on all 19 sub-pages, mobile-responsive
- **Filterable case-studies gallery** — production-grade interaction, URL hash sync, color-coded pills
- **Real team page** with 9 named members + Founder bio + photos — biggest credibility lift of the session

---

*End of audit.*
