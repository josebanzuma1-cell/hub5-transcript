# Porting this build to the next hub

> Written across hubs 1-4. Each hub appends what it learned; nothing here is
> specific to the hub you happen to be reading it in.

Each hub is its own workspace and its own repo. The reusable half is
`src/kit/` — copy that one folder and you inherit the design system, the
calculator engine, the charts and the page furniture. Everything else is
hub-specific and gets rewritten.

## What to copy

```
src/kit/                    <- copy wholesale, do not edit per hub
  styles/tokens.css         <- edit ONLY --c-accent* and the fonts
  styles/base.css
  styles/forms.css
  styles/components.css
  calc/engine.ts            <- mount(), input binding, debounce, URL state
  calc/finance.ts           <- pmt, amortize, futureValue, npv, irr
  calc/format.ts            <- currency/percent/months formatters
  calc/chart.ts             <- hand-rolled SVG line + stacked bar
  calc/url-state.ts
  components/*.astro        <- Field, SelectField, Segmented, Chart,
                               Logo, DataNote, ToolShell, RelatedTools
scripts/alias-loader.mjs    <- lets plain `node` run the model modules
astro.config.mjs
tsconfig.json               <- keep the @kit/* @data/* path aliases
```

Also copy `scripts/check-data.mjs` if the hub has programmatic data.

## What to rewrite

| File | What changes |
|---|---|
| `src/lib/site.ts` | Name, tagline, the `TOOLS` registry. This is the single source for nav, cards, footer and internal links. |
| `src/lib/tools/*.ts` | One module per calculator: `FIELDS`, `D`, `compute()`. |
| `src/styles/surfaces.css` | **The layout layer, and deliberately NOT in the kit.** This is what stops the portfolio looking like one template. Hub 1 uses a dark centred hero with a selector pill; Hub 2 a light split hero with a salary input and cards lifted over the hero edge. Rewrite it per hub. |
| `src/pages/**` | Page shells and prose. |
| `src/data/*` | Programmatic data sets. |
| `src/layouts/BaseLayout.astro` | Footer links and JSON-LD. Structure stays. |
| `--c-accent*`, `--c-deep*`, `--c-pop*` in `tokens.css` | The palette. `--c-deep` is the hero/header band, `--c-pop` the CTA that has to pop against it.
| `src/kit/components/Logo.astro`, `public/favicon.svg` | The mark. It fills from `--c-accent`, so the SVG only needs redrawing if the hub wants a different symbol. |

## The pattern for a new calculator

Four files, always in this order:

**1. Model** — `src/lib/tools/<name>.ts`

```ts
export const FIELDS: FieldSpec[] = [
  { key: 'loan', type: 'number', default: 400_000, min: 1_000, max: 10_000_000, dp: 0 },
];
export const D = FIELDS.reduce((m, f) => ((m[f.key] = f.default), m), {});
export interface MyModel { monthlyPayment: number; /* ... */ }
export function compute(v: Values): MyModel { /* pure function, no DOM */ }
```

Keep `compute` pure and DOM-free. That is what makes it testable with
`node --import ./scripts/alias-loader.mjs`, and testing the model is the
only thing standing between you and publishing wrong numbers at scale.

**2. Page** — `src/pages/tools/<slug>.astro`

```astro
<ToolShell title="..." intro="..." breadcrumbs={[...]} calcId="x">
  <form slot="controls" id="x-form"> <Field name="loan" value={D.loan} ... /> </form>
  <div slot="results" class="results">
    <b data-out="monthlyPayment" data-fmt="currency">—</b>
  </div>
  <section class="prose"> ... 800–1,500 words ... </section>
</ToolShell>
```

**3. Island** — a `<script>` at the bottom of the page

```ts
import { mount } from '@kit/calc/engine';
import { FIELDS, compute } from '../../lib/tools/<name>';
document.getElementById('x-form')?.addEventListener('submit', e => e.preventDefault());
mount<MyModel>({ id: 'x', fields: FIELDS, compute, onRender(m) { /* charts, tables */ } });
```

**4. Register** it in `src/lib/site.ts` so it appears in nav, cards and footer.

## Traps this build already hit

Numbered so later hubs can refer to them. Every one of these cost real time.

1. **Never name a component prop `slot`.** `slot` is Astro's reserved
   slot-assignment attribute. Any `<Thing slot="x" />` passed as a component's
   child is routed to a named slot — and silently discarded if none matches.
   No error, no output. Cost an entire ad tier here before it was spotted.

2. **The engine root must enclose every `data-out`.** `mount()` queries within
   `[data-calc]`. Scope it to just the controls/results grid and any figure in
   a section below stays an em dash forever. `ToolShell` puts it on the
   outermost `.page` div.

3. **Prose figures drift from the model.** The worked examples in the copy were
   wrong until the model tests printed the real numbers. Any figure you state
   in prose, print from the model first, then paste it.

4. **`npx astro` resolves the wrong Astro** if the shell's working directory is
   not the project. Use `./node_modules/.bin/astro` or `npm run build`.

## Advertising

This hub ships with no ad slots. If a later hub needs them, the original
reserved-height `AdSlot` component and its `--ad-h-*` tokens are recoverable
from git history at commit `bdc82c3`. The rule if you bring it back: fix the
container height in CSS before any ad script runs — never let a unit size
itself, or CLS goes with it.

## Checklist before launching a hub

- [ ] `npm run build` passes
- [ ] `node --import ./scripts/alias-loader.mjs scripts/test-finance.mjs` passes
- [ ] Every tool page has 800–1,500 words of prose
- [ ] Exactly one `<h1>` per page; canonical on every page
- [ ] All data rows `verified: true`, `PUBLIC_REQUIRE_VERIFIED=1` set in prod
- [ ] `SITE.url` set to the real domain (also in `robots.txt`)
- [ ] Every prose figure re-checked against model output

## Page furniture

Three band treatments, so every page reads as part of one system:

- **Homepage** — `.band`, a full-bleed `--c-deep` hero with a centred headline
  (wrap the emphasised word in `<em>` for the --c-pop highlight), the `.picker`
  selector + CTA, then `.trust` and `.tiles`.
- **Tool pages** — `.tool-band`, a soft mint gradient behind the breadcrumbs and
  h1 only. The calculator stays on plain ground: a results card has to read as
  an instrument, not another marketing panel.
- **Index and static pages** — `.page-band`, the same gradient, applied by
  wrapping the breadcrumbs and `.tool-hero` and reopening `.page` after it.

The `.trust` strip carries **verifiable properties of the product only** —
counts, guarantees you actually make. No ratings, no review counts, no
testimonials. Comparison sites lean hard on social proof; inventing it is how a
site loses the trust the strip is there to build.

5. **Don't use `perl -0pi -e 's|...|...|'` on markdown tables.** The `|`
   delimiter terminates at the first pipe in the replacement, silently
   truncating it and fusing the remainder into the next line. It corrupted this
   file's heading twice. Use `node -e` with explicit string ops for anything
   containing pipes.

## Why surfaces.css is not in the kit

The kit holds primitives that should behave identically everywhere: tokens,
form controls, the calculator engine, charts, the results card. The *layout* —
header treatment, hero shape, how cards sit on the page — is the thing that
has to differ, so it lives in `src/styles/surfaces.css` per hub.

This matters beyond aesthetics. The build plan warns that duplicating page
structure across a domain portfolio is the pattern doorway-page and
scaled-content detection targets. Different layouts reduce that footprint.
They are not the main protection though — genuinely different content, formulas
and internal linking are, and those come from each hub being about a different
subject. Treat the layout difference as hygiene, not as the defence.

Class names are the contract between the kit and the layout layer. `ToolShell`
renders `.tool-band`; each hub decides what that looks like.
## The kit boundary

Three things are per-hub and must NOT sit in `src/kit/`:

| Per-hub | Why |
|---|---|
| `src/styles/surfaces.css` | Layout. The hero shape, header treatment and card placement are what make two hubs look like two products. |
| `src/components/Logo.astro` | The mark. Each hub gets its own silhouette — at favicon size the outline is the only thing distinguishing them. |
| `src/kit/styles/tokens.css` **values** | The palette. Token *names* are the shared contract and never change; the hex values are rewritten per hub. This one file stays in the kit because its structure is shared even though its values are not. |

Everything else in `src/kit/` should be byte-identical across hubs. Check with:

```bash
diff -r src/kit ../hub-01-mortgage/src/kit --exclude=tokens.css
```

If that prints anything, a fix landed in one hub and not the other — port it
before the two drift further.
## Chart: log scale

`lineChart` takes an optional `logScale`. Use it when series span orders of
magnitude — a Monte Carlo percentile fan is the obvious case: the 90th
percentile reached $12M while the median ended near $800k, and on a linear
axis the two lines that mattered were flat against the bottom.

Ticks sit on powers of ten; the axis ends at the real maximum rather than
rounding up a decade. Values at or below zero are floored, so a depleted
portfolio renders instead of producing `log10(0)`.

Backported to hubs 1 and 2 — all four kits carry it.
## A third calculator layout

Hub 3 does not use `ToolShell`. It has `src/components/ToolCockpit.astro`:
the headline figure and its chart occupy a full-width dark panel, with the
controls in a horizontal rail beneath. Projections are thirty-year curves and a
half-width card wastes them.

See "A fourth calculator layout" below for the full table.

## Known divergence

Hub 1 still keeps `surfaces.css` and `Logo.astro` inside `src/kit/`. Hubs 2, 3
and 4 moved them out, because layout and mark are per-hub by definition.
Everything else in the kit is byte-identical across all four (`tokens.css`
values aside).

Aligning Hub 1 means moving two files and updating two imports in
`BaseLayout.astro`. Worth doing next time that workspace is open; it changes no
behaviour.

## A fourth calculator layout

Hub 4 uses neither `ToolShell` nor `ToolCockpit`. It has
`src/components/ToolStatement.astro`: the questions run down a single wide
column as numbered steps, and the answer rides in a bar that pins to the top
of the viewport once you scroll past it.

That shape was chosen for the subject. Working out how much cover you need is
a sequence of questions answered once — debts, then income, then what you
already hold — and the output is a line-item total, which is the shape of an
insurance quote. A two-column layout would put half the questions below the
fold with the answer stranded beside step one.

Four layouts across four hubs now:

| Hub | Layout | Chosen because |
|---|---|---|
| 1 | `ToolShell`, side by side | one figure, adjusted repeatedly |
| 2 | `ToolShell` on a light split page | same, with a state switcher |
| 3 | `ToolCockpit`, dark panel + rail | thirty-year curves need width |
| 4 | `ToolStatement`, worksheet + sticky bar | a sequence of questions, a line-item answer |

Pick per hub based on what the tool needs to show. Do not default to copying
the last one, and do not vary for variety's sake.

### The sticky bar needs a sentinel

`.quote-bar` is `position: sticky`. The `is-stuck` class that raises it is
driven by an `IntersectionObserver` on a separate 1px `.quote-bar__sentinel`
above it — never on the bar itself, which would be observing its own stuck
state. With JS off the bar still sticks; it just never picks up the shadow.

### Change-flash lives outside the kit

`src/scripts/flash.ts` briefly tints any `[data-out]` whose text changes, so
editing step five visibly moves the figure in the bar at the top of the
screen. It is a `MutationObserver`, deliberately NOT in the kit: it exists
because of this hub's layout, and hubs 1-3 keep their controls beside their
results and do not need it. Keeping it out means the engine — and therefore
the kit — stays byte-identical across the portfolio.

## Traps this build added

6. **`requestAnimationFrame` is throttled in a hidden tab.** The engine
   debounces compute and hands the paint to rAF, so a backgrounded preview
   tab shows stale outputs no matter how long you wait. This is correct
   behaviour — it repaints on return — but it will convince you the calculator
   is broken when you are driving it from a hidden pane. Front the tab before
   measuring.

7. **Don't set `--logo-glyph` to the surface the mark sits on.** The header
   set it to `--c-deep`, which painted the shield's filled half in exactly the
   header's own background. The mark silently lost its silhouette and read as
   a cut-off arch. Render the logo at 96px against both grounds before
   shipping it; at 26px you cannot see what is wrong, only that something is.

8. **Tune defaults so the interesting branch actually runs.** The HDHP tool's
   first defaults made one plan win at every level of spending, so `crossover`
   was always `null` — the headline output of the tool, and the solver behind
   it, were completely unexercised by the test suite and the default view
   taught the reader nothing. Defaults are test fixtures as much as they are
   copy.

9. **A "states that ban X" list is almost never about the thing you mean.**
   Three of nine credit-rule rows in hub 4 were wrong, all from the same
   cause: the widely repeated lists of states that "ban credit scoring" merge
   bans on credit in *underwriting* decisions, bans in *homeowners* rating,
   and partial limits into one column. Michigan appears on every such list and
   in fact permits credit in auto rating — its regulator's ban was struck down
   in 2010. Find the source that separates by line of business and by use
   (for insurance, the NAIC model law charts), and read the state's own entry
   rather than a summary of it.

10. **The source that obviously covers a topic may not cover every state.**
    California's prohibition on credit in auto rating is absent from the NAIC
    credit chart, because it does not come from a credit statute at all — it
    comes from Proposition 103 making auto rating a closed list of permitted
    factors. Absence from the obvious source is not evidence of absence of
    regulation.

11. **Verification finds rules, not just numbers.** All six HSA figures were
    already right, so on a numbers-only view the check was wasted. It was not:
    reading the source surfaced IRS Notice 2026-05, under which bronze and
    catastrophic plans count as high-deductible plans even when they fail both
    statutory tests. The eligibility check had been returning a false negative
    on exactly those plans. Budget verification time for what you will learn,
    not only for what you will confirm.

12. **Split provenance when the sources differ.** One `verified` flag per row
    could not express "no-fault and credit checked, premiums not", so it would
    have had to be set to whichever value was convenient — and a flag that
    cannot express the truth always ends up lying. Hub 4 carries
    `verifiedPremiums`, `verifiedLiability` and a module-level
    `LEGAL_PROVENANCE`, and the page renders one notice per group.

13. **A clean parse is not a correct parse.** Extracting the NAIC premium
    tables with `pdftotext -layout` gave perfectly formed rows — state name,
    five columns, plausible magnitudes — that were shifted against one another
    across page boundaries. It put Louisiana below the national average and
    Maine second-most-expensive, and every structural check passed. What
    caught it was an identity the source itself asserts (combined = liability
    + collision + comprehensive), which failed on 49 of 51 rows. When you
    import tabular data, validate with anchors whose values you know
    independently — a total quoted in the document's prose, the known extremes
    — not with "did it parse".

14. **If the schema cannot express the truth, it will assert something false.**
    Hub 4 stored compulsory auto minimums as a `"25/50/25"` string. Two states
    break that: New Hampshire compels no insurance at all, and Florida compels
    no bodily injury cover. The string had no way to say either, so it said
    something wrong instead. The replacement returns `null` from its formatter
    for states it cannot reduce to three numbers — which forces every caller to
    handle the case rather than printing a plausible-looking lie. That change
    immediately exposed a live bug: a page was printing the formatted limits
    under a heading reading "Minimum you must carry" without checking whether
    the state actually compelled anything.

## A fifth calculator layout

Hub 5 uses `src/components/ToolRoster.astro`: a table the reader adds rows to,
with a result card that stays in view while they edit it.

The reason is not variety. Every other hub takes a fixed set of numbers — one
balance, one salary, one premium — and the kit's engine binds exactly that.
This hub's inputs are **lists**: a GPA is a list of courses, a course grade is
a list of weighted components, and student debt is a list of loans. Treating
that last one as a single blended balance hides the only decision the borrower
controls, which is where the extra payment goes.

Five layouts across five hubs now:

| Hub | Layout | Chosen because |
|---|---|---|
| 1 | `ToolShell`, side by side | one figure, adjusted repeatedly |
| 2 | `ToolShell` on a light split page | same, with a state switcher |
| 3 | `ToolCockpit`, dark panel + rail | thirty-year curves need width |
| 4 | `ToolStatement`, worksheet + sticky bar | a sequence of questions, a line-item answer |
| 5 | `ToolRoster`, editable table + score card | the input is a list, not a set of fields |

### The roster is deliberately NOT in the kit

`src/lib/roster.ts` manages rows, add/remove, and URL state. Extending the
kit's engine to bind a variable number of rows would have meant editing a file
that must stay byte-identical across five hubs, to serve one of them. The
roster is 160 lines and hub-local; the kit is untouched.

It still had to provide a shareable URL, because that is load-bearing for the
whole portfolio. Rows encode into one query parameter with `~` between fields
and `!` between rows — neither survives in a course name or a loan nickname,
and neither needs percent-encoding.

### Source order puts the result first

On a phone the score card comes before the table, because watching the number
move as you type is the entire experience. CSS reorders it on desktop. Getting
this the other way round would bury the answer below a form.

## Traps this build added

17. **A demo where both figures agree demonstrates nothing.** The hero runs a
    live three-row GPA, and its first version defaulted every row to "Regular"
    — so weighted and unweighted both read 3.67 and the hero silently argued
    that the distinction it exists to teach does not matter. Defaulting to
    Honours makes the two figures separate on load. Check what your defaults
    actually SHOW, not just that they compute.

18. **Seed data can hide a broken branch.** The loan tool's default loans made
    avalanche and snowball produce identical totals, because the highest-rate
    loan happened to also be the smallest. A strategy switch that did nothing
    would have passed. The test suite now includes a case where rate and size
    disagree, precisely so the two strategies must diverge.

19. **`Number('')` is 0, so stripping non-numerics turns rubbish into a clean
    zero.** The scale converter parsed `"abc"` by removing everything
    non-numeric and calling `Number` on what was left — an empty string, which
    is 0, which is a valid grade. Rubbish came back as a confident 0.0 rather
    than a rejection. Guard the *strip result*, not just `Number.isFinite` on
    the output.

20. **A converter whose round trip does not close is telling two stories.** The
    Indian CGPA scale was parsed with a linear formula and rendered from a band
    table, and the two disagreed: 8.7 went in as 3.22 and came back out as
    8.5–8.9. Whenever a model converts both ways, assert that a value survives
    the trip — the data gate does this now for all three numeric scales.

21. **Verify before you build, when the subject is moving.** The plan called
    for a "SAVE/IBR/PAYE" comparison. SAVE had been ended by court order in
    March 2026 and replaced by RAP in July, so building to the brief would have
    shipped a calculator for a plan nobody can enrol in. Ten minutes of
    checking changed the tool's entire shape — eligibility now turns on when
    the loans were disbursed, a question no pre-2026 version had to ask.

## Traps found building tools 27 and 28

**A generated data file needs a generator in the repo, not a memory of one.**
`src/data/colleges.ts` is 142 rows written by `scripts/import-scorecard.mjs`.
The generator is committed alongside its output for a reason: the next person
to touch this data will otherwise hand-edit the rows, and the provenance stamp
will keep claiming an import that no longer describes the file.

**A structural gate has to be tuned to the failure it is looking for.** The
first version of the colleges check flagged *any* net price that fell as income
rose, and it fired on twelve institutions — all of them $150–500 wobbles in
genuine published averages. The mistake worth catching is reading the private
net-price series for a public institution, which moves thousands. A gate that
cries wolf on real data teaches you to ignore it, so the threshold is now
$1,500 *and* 10%, plus a separate check that the top band never pays less than
the bottom overall.

**Do not reach for the roster manager just because the shape looks like rows.**
Tool 27 renders a per-year table, but the rows are *derived* from the inputs
rather than edited by the reader. `mountRoster` exists to serialise
reader-edited rows into the URL; using it here meant rebuilding the row body on
every keystroke, which threw away the `data-k` cells the nudge text reads. The
island builds its own table and leaves the roster manager to tools 20 and 25.

**Interest starts when each year is drawn, not at graduation.** Treating four
years of borrowing as one balance appearing on the last day understates the
debt by about 16% at 6%. The model compounds year by year, which is why a
one-year degree in the tests still shows a year of interest — a fact that broke
two test expectations before it was the model that got checked.

**A prose claim about arithmetic is a test.** The FAQ originally said repayment
passes ~10% of income once debt exceeds first-year salary. The model says debt
*equal* to salary already costs 13.3%, and 10% arrives at about three-quarters
of salary. The sentence was wrong in a way no reader would catch and no build
would fail on; it is now pinned by two assertions.
