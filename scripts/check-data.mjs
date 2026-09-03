/* Data verification gate. Runs before every build.

   This hub began with NO external data — a GPA is computed entirely from what
   the reader enters, and the grade scale is a convention rather than a
   published figure. The repayment tools changed that: federal poverty
   guidelines and repayment plan rules are published, they change annually, and
   the 2026 changes were large enough that a stale copy would be actively
   misleading. So they carry provenance like every other data set in the
   portfolio, and the conventions still get consistency checks instead. */
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('@kit/')) return next(pathToFileURL(path.join(root, 'src/kit', spec.slice(5) + '.ts')).href, ctx);
    if (spec.startsWith('@data/')) return next(pathToFileURL(path.join(root, 'src/data', spec.slice(6) + '.ts')).href, ctx);
    return next(spec, ctx);
  },
});
const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const { GRADES, LEVELS } = await load('src/lib/tools/gpa.ts');
const { SCALES, toPoints } = await load('src/lib/tools/scale.ts');
const { POVERTY_2026, POVERTY_VERIFIED, PLANS, PLANS_VERIFIED, RAP_BANDS, povertyLine } = await load('src/data/student-aid.ts');
const { MAX_AGE_DAYS } = await load('src/data/types.ts');
const { GIFT_2026, GIFT_VERIFIED } = await load('src/data/student-aid.ts');
const { COLLEGES, SCORECARD_VERIFIED } = await load('src/data/colleges.ts');

const strict = process.env.PUBLIC_REQUIRE_VERIFIED === '1';
const problems = [];
let unverified = 0;

function checkProvenance(label, v) {
  if (v === false) { unverified++; console.log(`  ${label}: UNVERIFIED`); return; }
  if (!v || typeof v !== 'object') { problems.push(`${label}: verified must be false or a provenance record`); return; }
  for (const k of ['checkedOn', 'source', 'by']) if (!v[k]) problems.push(`${label}: provenance missing "${k}"`);
  const age = (Date.now() - Date.parse(v.checkedOn)) / 86_400_000;
  if (Number.isNaN(age)) problems.push(`${label}: checkedOn is not a date`);
  else if (age > MAX_AGE_DAYS) problems.push(`${label}: last checked ${Math.round(age)} days ago (limit ${MAX_AGE_DAYS})`);
  console.log(`  ${label}: verified`);
}

// --- conventions, which have no source to check against ---
if (Math.max(...GRADES.map((g) => g.points)) !== 4) {
  problems.push('the unweighted scale must top out at 4.0 — a higher ceiling inflates every GPA');
}
if (Math.min(...GRADES.map((g) => g.points)) !== 0) problems.push('the scale must bottom out at 0.0');
for (let i = 1; i < GRADES.length; i++) {
  if (GRADES[i].points > GRADES[i - 1].points) problems.push(`grade scale out of order at ${GRADES[i].id}`);
}
const aPlus = GRADES.find((g) => g.id === 'A+');
const a = GRADES.find((g) => g.id === 'A');
if (aPlus && a && aPlus.points !== a.points) {
  problems.push('A+ must equal A at 4.0 — awarding 4.3 inflates in the direction nobody checks');
}
if (!LEVELS.some((l) => l.bonus === 0)) problems.push('there must be an unweighted course level');
for (const l of LEVELS) if (l.bonus < 0 || l.bonus > 2) problems.push(`implausible weighting bonus for ${l.id}`);
console.log(`  grade scale: ${GRADES.length} grades, ${LEVELS.length} course levels`);

/* Every band table must be contiguous and cover 0 to 4, or a grade can fall
   into a hole and convert to nothing. ECTS is empty on purpose. */
for (const [id, scale] of Object.entries(SCALES)) {
  if (id === 'ects') continue;
  const b = [...scale.bands].sort((x, y) => x.from - y.from);
  if (!b.length) { problems.push(`${id}: no bands`); continue; }
  if (b[0].from !== 0) problems.push(`${id}: bands must start at 0`);
  for (let i = 1; i < b.length; i++) {
    if (Math.abs(b[i].from - b[i - 1].to) > 0.001) problems.push(`${id}: gap or overlap between bands at ${b[i].from}`);
  }
  if (b[b.length - 1].to < 4) problems.push(`${id}: bands must reach 4.0`);
}
/* Round trips must close. A converter that disagrees with itself is telling
   two stories, and this caught a real inconsistency in the Indian scale. */
for (const [raw, id, expect] of [['70', 'uk', 3.70], ['8.7', 'india10', 3.66], ['92', 'uspct', 3.84]]) {
  const p = toPoints(raw, id);
  if (p === null || Math.abs(p - expect) > 0.06) {
    problems.push(`scale round trip: ${raw} on ${id} gave ${p}, expected about ${expect}`);
  }
}
console.log(`  scale tables: ${Object.keys(SCALES).length} scales, round trips close`);

// --- external data ---
checkProvenance('poverty guidelines (2026)', POVERTY_VERIFIED);
checkProvenance('repayment plans', PLANS_VERIFIED);
for (const region of ['contiguous', 'alaska', 'hawaii']) {
  const s = POVERTY_2026[region];
  if (!(s.base > 5_000 && s.base < 60_000)) problems.push(`${region}: implausible poverty base ${s.base}`);
  if (!(s.perPerson > 1_000 && s.perPerson < 20_000)) problems.push(`${region}: implausible per-person amount`);
  if (povertyLine(2, region) <= povertyLine(1, region)) problems.push(`${region}: guideline must rise with household size`);
}
if (!(POVERTY_2026.alaska.base > POVERTY_2026.contiguous.base)) problems.push('Alaska guideline must exceed the contiguous states');
if (!(POVERTY_2026.hawaii.base > POVERTY_2026.contiguous.base)) problems.push('Hawaii guideline must exceed the contiguous states');

for (const p of PLANS) {
  if (p.basis === 'discretionary' && !(p.rate > 0 && p.rate <= 25)) problems.push(`${p.id}: implausible rate`);
  if (!(p.forgivenessYears >= 10 && p.forgivenessYears <= 40)) problems.push(`${p.id}: implausible forgiveness term`);
  if (p.loansFrom && p.loansBefore) problems.push(`${p.id}: cannot be both before and from a date`);
  if (!p.note || p.note.length < 40) problems.push(`${p.id}: needs a note explaining who it is for`);
}
if (PLANS.some((p) => p.id === 'save')) problems.push('SAVE ended by court order on 10 March 2026 and must not be offered');
let prev = -1;
for (const b of RAP_BANDS) {
  if (b.rate < prev) problems.push('RAP bands must not decrease');
  prev = b.rate;
}
if (RAP_BANDS[RAP_BANDS.length - 1].upTo !== null) problems.push('the top RAP band must be open-ended');
console.log(`  repayment: ${PLANS.length} plans, ${RAP_BANDS.length} RAP bands`);


// --- gift tax exclusion, used by the 529 planner ---
checkProvenance('gift tax exclusion (2026)', GIFT_VERIFIED);
if (GIFT_2026.fiveYearElection !== GIFT_2026.annualExclusion * 5) {
  problems.push('the five-year election must be exactly five annual exclusions');
}
if (!(GIFT_2026.annualExclusion > 10_000 && GIFT_2026.annualExclusion < 50_000)) {
  problems.push(`implausible gift tax annual exclusion ${GIFT_2026.annualExclusion}`);
}

// --- College Scorecard import ---
checkProvenance('college scorecard', SCORECARD_VERIFIED);
console.log(`  colleges: ${COLLEGES.length} institutions`);
const slugs = new Set();
for (const c of COLLEGES) {
  if (slugs.has(c.slug)) problems.push(`colleges: duplicate slug "${c.slug}" — one page would overwrite the other`);
  slugs.add(c.slug);
  if (!(c.netPrice > 0)) problems.push(`${c.name}: net price must be positive`);
  if (c.netPrice > 100_000) problems.push(`${c.name}: implausible net price ${c.netPrice}`);
  if (c.sticker != null && c.sticker < c.netPrice) {
    problems.push(`${c.name}: sticker (${c.sticker}) is below net price (${c.netPrice}) — one of them is wrong`);
  }
  if (c.completion != null && (c.completion < 0 || c.completion > 1)) {
    problems.push(`${c.name}: completion rate must be a fraction, got ${c.completion}`);
  }
  if (c.earnings10 != null && !(c.earnings10 > 5_000 && c.earnings10 < 500_000)) {
    problems.push(`${c.name}: implausible earnings ${c.earnings10}`);
  }
  if (!['public', 'private', 'for-profit'].includes(c.ownership)) {
    problems.push(`${c.name}: unknown ownership "${c.ownership}"`);
  /* Net price should rise with income overall. Small dips between adjacent
     bands are normal — these are averages of real awards, and merit aid is
     not distributed smoothly — so only a LARGE inversion is flagged, because
     that is the signature of the import having mixed the public and private
     columns for a row rather than of ordinary variation. */
  const bands = [c.byIncome.low, c.byIncome.lowMid, c.byIncome.mid, c.byIncome.upperMid, c.byIncome.high]
    .filter((v) => v != null);
  for (let i = 1; i < bands.length; i++) {
    const drop = bands[i - 1] - bands[i];
    if (drop > 1_500 && drop > bands[i - 1] * 0.10) {
      problems.push(`${c.name}: net price falls sharply as income rises (${bands[i - 1]} then ${bands[i]}) — check the import mapped the right ownership column`);
      break;
    }
  }
  if (bands.length >= 2 && bands[bands.length - 1] < bands[0]) {
    problems.push(`${c.name}: the highest income band pays less than the lowest overall`);
  }
  }
}

console.log('');
if (problems.length) {
  console.error('Structural problems:');
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('  no structural problems');
if (unverified && strict) {
  console.error(`\n✗ ${unverified} unverified figure(s) and PUBLIC_REQUIRE_VERIFIED=1. Refusing to build.`);
  process.exit(1);
}
if (unverified) console.log(`\n  ${unverified} unverified figure(s).`);
