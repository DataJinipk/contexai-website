# Out-of-Box Designs — Design Features to Adopt for ContexAi

**Reference:** https://outofboxdesigns.co.uk/
**Date:** 13 June 2026
**Status:** Recommendation memo
**Author:** ContexAi Group, with Amir Waheed Ahmed

---

## 1. What Out-of-Box Designs does well (and badly)

OoB is a UK digital agency — they sell creative services to SMBs. Different DNA from ContexAi, **but** they have nailed several home-page conventions that work universally for any professional services firm. Worth borrowing the patterns, not the aesthetic.

### Their pattern (top-to-bottom)
1. Bold serif hero — "Creativity **Unlimited**" (one accent word in bold/italic)
2. Two CTAs side-by-side (Our Services · Our Portfolio)
3. About blurb + "Learn More"
4. **12-tile service grid** with custom SVG icons (Graphics · Websites · Mobile Apps · Content · Marketing · Animation · SEO · 3D Models · Cloud · Web Apps · VR · AI)
5. **Global presence statement** — "Over 11 years grown from UK startup to global team across 4 continents" + world map with flag markers
6. **Filterable portfolio / works gallery** — category pills (Show All · Banner · Branding · Brochure · Flyer · Illustration · Infographic · Website Design)
7. Client testimonials — photo + name + company + role + quote
8. **Client logo wall** — 10+ recognizable brand logos (Etihad · Guinness · WILEY · UCL · Admiral · Careem · Belvita · British Council …)
9. Blog cards with author byline + date + social-share strip + Read More
10. Footer with Recent Posts · Email · Contact · Tags · Newsletter signup

### What's bad (don't copy)
- Heavy on stock icons and SVG placeholders (looks dated)
- "Tags cloud" in footer feels SEO-y from 2014
- 6 social-share icons per blog post is noisy
- Hero copy reads like agency-speak ("Bespoke brand-boosting graphic designs…")

---

## 2. Eleven design features worth adopting for ContexAi

Ranked by what would move the needle most for **a senior advisory firm** (not an agency).

| # | Feature | Why it helps ContexAi | Effort | Priority |
| --- | --- | --- | --- | --- |
| **1** | **Filterable case-studies gallery** with practice-color category pills | Once we publish anonymized SMFB / TSH / CIP / Cnergyico engagements, a filter (Show All · Banking · Real Estate · Energy · Accreditation · Agentic AI) makes the depth scannable. This is the single biggest credibility lift. | High (needs content) | P0 |
| **2** | **Client logo wall** (anonymized or named) | Even one row of vetted client/employer marks (SBP · SECP · PSX · CIP · partners) builds trust instantly. Currently the home page has zero logo recognition. | Medium | P0 |
| **3** | **Global presence statement + map** | "Founded in Karachi · Active across Pakistan, GCC, and expanding" with subtle flag/pin map = the "we are not just a one-city shop" signal Virtuosoft has and we don't. | Medium | P1 |
| **4** | **Testimonial carousel with photo + role + company** | Three text-only testimonials feel anonymous. Adding photo + role makes them human. Even silhouette avatars + role + sector beats text-only. | Medium | P1 |
| **5** | **Service grid expansion** (4 tabs → 12 tiles with icons) | Phase 2 adds 7 new services. A 12-tile grid (currently 4 tabs) mirrors OoB and Virtuosoft, signals breadth, and gives every service its own SEO-able landing page. | High (gated on Phase 2 services) | P1 |
| **6** | **Author byline + date on Insights posts** | Right now Insights cards have no author. Adding "By Amir Ahmed · Founder, ContexAi" or "By [SME name]" raises the bar from "blog" to "authored research". | Low | P1 |
| **7** | **"X years experience" milestone counter / mini-timeline** | We have "24+ Years Experience" stat in hero. Could be expanded to a horizontal milestone strip — "2002 PwC · 2008 First MFB build · 2018 First REIT · 2026 Founded ContexAi" — humanizes the founder. | Low | P2 |
| **8** | **Bold serif H1 with one accent word** | "Creativity **Unlimited**" pattern. We already do "Strategic Advisory & *Intelligence in Context*". Could be punchier — "**Senior expertise.** Agentic intelligence." | Low | P2 |
| **9** | **Newsletter signup in footer** | Builds owned audience. We have an Insights page but no way to subscribe. Even a single email field calling for "Quarterly ContexAi Briefing" would compound. | Low | P1 |
| **10** | **Sticky CTA on long pages** ("Talk to ContexAi" floats bottom-right) | Practice pages are scroll-long. A floating CTA is a 5-line addition that lifts contact form conversion materially. | Low | P1 |
| **11** | **Social-share buttons on Insights articles** (LinkedIn + X + email only) | Currently no share controls. Don't go OoB's 6-button heavy — keep to LinkedIn (our primary distribution) + X + Copy Link. | Low | P2 |

### Explicitly don't copy
- Stock SVG icon clipart (looks 2014)
- Tag clouds in footer
- 6+ social-share icons per article
- Agency-speak hero copy ("…resonate easily with audiences")

---

## 3. Recommended Phase 1.5 — small additions next

Before Phase 2 (new service verticals) lands, drop these in. They're all <1 day each and compound the brand visibly.

### 3.1 Quick wins (this week)
- **(A)** Add author byline + date to all 3 Insights articles (`By Amir Waheed Ahmed · Founder, ContexAi · 9 June 2026`)
- **(B)** Newsletter signup in footer of `index.html` (single email field → posts to existing Worker)
- **(C)** Sticky "Talk to ContexAi" floating CTA on practice pages and Insights
- **(D)** LinkedIn + X + Copy-link share buttons at top + bottom of each Insights article

### 3.2 Medium effort (next two weeks)
- **(E)** Client logo wall on home page — even if anonymized first ("SBP-regulated MFB" tile + "Section 42 NPO in build" tile + "Pakistani industrial holding" tile + "Pakistan's largest refinery" tile). Replace with real logos when NDA permissions come through.
- **(F)** Founder milestone timeline strip on `/team/` page below the founder card — 5-6 milestones, 2002 → 2026
- **(G)** Replace 3 testimonial text-cards with photo+role+company structure (use placeholder avatars + "Sector: Banking / Energy / Infrastructure" until real photos are approved)
- **(H)** Global presence section — "Karachi (HQ) · GCC reach · Active across MENA" with a clean SVG map + 4-5 flag pins

### 3.3 Big lift (Phase 1.7 — pre-Phase 2)
- **(I)** Case-studies gallery at `/case-studies/` with filterable category pills (Show All · Banking · Real Estate · Energy · Accreditation · Agentic AI · Cross-cutting). Even 3 anonymized case studies launch credible.

---

## 4. Mapping to Phase plan

| Phase | Status | Picks up |
| --- | --- | --- |
| **Phase 0 — Brand v2** | DONE | Palette ribbon · tinted backgrounds · per-card colors |
| **Phase 1 — IA + Practice pages + Team page** | DONE | `/practices/*` · `/team/` · home practices strip · nav refactor |
| **Phase 1.5 — Trust + distribution polish** (NEW) | NEXT | A · B · C · D · E · F · G · H above |
| **Phase 1.7 — Case studies gallery** (NEW) | After 1.5 | I (filterable gallery) |
| **Phase 2 — Service expansion** | Gated on the 6 open questions | 7 new service pages + 12-tile services grid |
| **Phase 3 — Industries page** | Q3 | `/industries/` |
| **Phase 4 — Network expansion** | Q4 | `/careers/` · `/offices/` |

---

## 5. Recommendation

**Approve Phase 1.5** — eight small additions that take ~2 weeks total and visibly close the gap with both OoB-style agencies and Virtuosoft-style firms on **credibility surfaces**:

- Author bylines on Insights (1 hour)
- Newsletter signup in footer (2 hours, reuses existing Worker)
- Sticky CTA on long pages (30 mins of CSS)
- Social share buttons on Insights (1 hour)
- Anonymized client/sector tile wall on home (3 hours)
- Founder milestone timeline (2 hours)
- Photo/role/company testimonial cards (2 hours, even silhouette avatars)
- Global presence map (3 hours, single SVG)

**Total ~14 hours of design/dev work to land a meaningful credibility lift.** Then Phase 1.7 (case-studies gallery) when you have 3 anonymized engagement stories cleared for publication.

---

*End of memo.*
