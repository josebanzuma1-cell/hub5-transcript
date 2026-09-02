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
| 23 | Grade needed on the final | Says when the target is unreachable, and when the grade is already secured, instead of printing "you need 118%" |
| 25 | Student loan payoff | Loans listed individually; compares avalanche, snowball and minimums, and reports what the snowball costs rather than dismissing it |

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

**This hub publishes no external data**, which is a property of the subject.
Every figure comes from the reader. The two conventions the site does supply —
the four-point grade scale and the honours/AP weighting — are conventions, not
published facts, and every page says a school's own scale is the authority.

`npm run data:check` therefore checks internal consistency rather than
provenance: that the scale is ordered and bounded, that A+ is 4.0 and not 4.3,
and that the weighting is sane.

## Before launch

- [ ] Set `SITE.url` to the real domain, in `src/lib/site.ts`, `astro.config.mjs` and `public/robots.txt`
- [ ] Decide whether to build the remaining plan tools (21, 22, 24, 26, 27, 28)
- [ ] Time the launch for term end — tool 23 spikes hard in December and May
