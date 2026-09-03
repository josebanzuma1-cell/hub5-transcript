# Transcript — grade and student finance calculators

Hub 5 of the utility site portfolio. Eight calculators, no ad slots, no lead
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
| 27 | True cost of college | Works from published net price for *your* family income band, not the sticker — the same institution can differ by $49,899 a year between bands — and compounds each year's borrowing from the year it is drawn |
| 28 | 529 / scholarship planner | Targets a third of the cost rather than all of it, and puts a number on what waiting one year costs |

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
- [ ] Decide on plan tool 24 — see the note below
- [ ] Re-check the poverty guidelines and repayment rules each January
- [ ] Refresh the College Scorecard import when a new academic year lands
- [ ] Time the launch for term end — tool 23 spikes hard in December and May

## One plan tool deliberately not built

**24 — class rank / honours threshold.** The plan itself says "thin data —
check availability first". Availability is poor: class rank thresholds are set
per school or district and are rarely published, and honours cut-offs (cum
laude and above) are per institution. There is no data set to build a
programmatic surface on, and a calculator that asks you to supply the threshold
is answering a question you had already answered.

## The College Scorecard import

Tools 27 and 28 rest on `src/data/colleges.ts`, which is generated — never hand
edited — by `scripts/import-scorecard.mjs` from the U.S. Department of
Education's College Scorecard API. Regenerate with:

```
node scripts/import-scorecard.mjs            # dry run, prints what would change
node scripts/import-scorecard.mjs --write    # writes src/data/colleges.ts
```

It runs against `DEMO_KEY` by default, which is rate limited; set
`SCORECARD_API_KEY` in `.env` for a real key. The import keeps 142 institutions
chosen for coverage rather than prestige — every state represented, and the
public/private/for-profit mix roughly matching where students actually enrol.

Three things about this data are worth knowing before touching it:

- **Net price is published by family income band, and the spread is the whole
  point of tool 27.** The widest published low-to-high gap in the set is
  $49,899 a year at one institution; the median gap is $12,982. A page that
  quoted a single "average net price" would be hiding the only number that
  matters.
- **The API returns a separate net-price series for public and for private
  institutions**, under different field names. Reading the wrong one yields
  plausible numbers that are silently wrong, so `npm run data:check` flags any
  row where net price falls sharply as income rises — the signature of that
  mistake. Small dips between adjacent bands are normal and are not flagged;
  these are averages of real awards and merit aid is not distributed smoothly.
- **Not every institution reports everything.** Earnings, completion rate and
  individual income bands are all nullable, and the models fall back rather
  than substituting zero. 142 rows carry earnings; 140 carry a full income
  breakdown.
