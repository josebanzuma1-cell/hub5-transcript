# Transcript — grade and student finance calculators

Hub 5 of the utility site portfolio. Three calculators, no ad slots, no lead
capture, nothing sent to a server.

```bash
npm install
npm run dev          # http://localhost:3029
npm run build        # runs the data gate, then builds
npm test             # model checks
```

## The tools

| # | Tool | What makes it different |
|---|---|---|
| 20 | GPA calculator | Shows weighted and unweighted together, because which one you need depends on who is asking |
| 21 | Cumulative GPA planner | Weights terms by credits rather than averaging them, and says when a target is unreachable this term |
| 22 | GPA scale converter | US, UK and Indian scales — and refuses to output an ECTS grade, because ECTS ranks you against a cohort and no mark determines it |
| 23 | Grade needed on the final | Says when the target is unreachable, and when the grade is already secured, instead of printing "you need 118%" |
| 25 | Student loan payoff | Loans listed individually; compares avalanche, snowball and minimums, and reports what the snowball costs rather than dismissing it |
| 26 | Income-driven repayment | Models the 2026 landscape: SAVE is gone, RAP is the only plan for loans from July 2026, and eligibility turns on when you borrowed |

## The funnel is the point

The plan is explicit that grade tools bring traffic and barely monetise, while
loan tools carry five to ten times the CPC. They share a domain for exactly
that reason: a student checking a GPA is one click from "what will this degree
cost me". `site.ts` groups the tools accordingly and every grade page links
into the money group.

## Layout

Fifth distinct calculator layout in the portfolio: `ToolRoster` — an editable
table with a result card that stays in view. Chosen because this hub's inputs
are lists rather than fixed fields. See `PORTING.md`.

## Data

The grade tools publish **no external data** — every figure comes from the
reader, and the conventions the site supplies (the four-point scale, the
honours/AP weighting, the cross-scale bands) are conventions rather than
published facts. Every page says so.

The repayment tools do publish external data, and it changes:

- **Federal poverty guidelines**, reissued by HHS each January
- **Repayment plan rules**, which changed twice in 2026 — SAVE ended by court
  order on 10 March and RAP arrived on 1 July

Both carry provenance and a 400-day staleness gate. `npm run data:check`
verifies those, and separately checks the conventions for internal
consistency: that the scale is ordered and bounded, that A+ is 4.0 and not 4.3,
that every band table is contiguous, and that the converter's round trips
close.

**Re-check every January.** The poverty guidelines move annually and the
repayment rules are unusually volatile right now.

## Before launch

- [ ] Set `SITE.url` to the real domain, in `src/lib/site.ts`, `astro.config.mjs` and `public/robots.txt`
- [ ] Decide on plan tools 24, 27 and 28 — see the note below
- [ ] Re-check the poverty guidelines and repayment rules each January
- [ ] Time the launch for term end — tool 23 spikes hard in December and May

## Two plan tools deliberately not built

**24 — class rank / honours threshold.** The plan itself says "thin data —
check availability first". Availability is poor: class rank thresholds are set
per school or district and are rarely published, and honours cut-offs (cum
laude and above) are per institution. There is no data set to build a
programmatic surface on, and a calculator that asks you to supply the threshold
is answering a question you had already answered.

**27 — true cost of college.** This one is buildable and worth building, but it
is a data project rather than an afternoon: per-institution net price comes
from IPEDS and the College Scorecard, which is thousands of rows with real
provenance obligations. It deserves its own pass rather than being bolted on.

**28 — scholarship / 529 planner** is straightforward and was left for the same
pass, since it shares the savings-projection machinery with hub 3.
