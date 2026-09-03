/* Model checks. Run: npm test

   Every figure quoted in page prose is printed here first — a worked example
   written by hand drifts from the model within one refactor, and a wrong
   number in prose is indistinguishable from a wrong number in the calculator
   to the person reading it. */
import { compute as gpa, cumulative, GRADES, LEVELS } from '../src/lib/tools/gpa.ts';
import { computeWith as final } from '../src/lib/tools/final-grade.ts';
import { computeWith as loans } from '../src/lib/tools/loan-payoff.ts';
import { computeWith as cumTerms } from '../src/lib/tools/cumulative.ts';
import { compute as convert, toPoints } from '../src/lib/tools/scale.ts';
import { compute as idr, standardPayment } from '../src/lib/tools/idr.ts';
import { povertyLine, PLANS, GIFT_2026 } from '../src/data/student-aid.ts';
import { compute as cost, netPriceFor } from '../src/lib/tools/college-cost.ts';
import { compute as sav, requiredMonthly } from '../src/lib/tools/savings-529.ts';
import { COLLEGES } from '../src/data/colleges.ts';

let pass = 0, fail = 0;
const chk = (n, a, e, t = 0.005) => {
  const ok = Math.abs(a - e) <= t; ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : `\n      got ${a} expected ~${e}`}`);
};
const ok = (n, cond) => chk(n, cond ? 1 : 0, 1, 0);
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

/* ================================ GPA ================================ */
const courses = [
  { name: 'AP Biology', credits: '1', grade: 'A-', level: 'ap' },
  { name: 'English 11', credits: '1', grade: 'B+', level: 'reg' },
  { name: 'Honours Pre-Calculus', credits: '1', grade: 'A', level: 'honors' },
  { name: 'US History', credits: '1', grade: 'B', level: 'reg' },
];
const G = gpa(courses);
console.log('\n--- GPA (the page defaults) ---');
console.log('  unweighted', G.unweighted.toFixed(3), '| weighted', G.weighted.toFixed(3),
  '| credits', G.totalCredits, '| bonus', G.weightBonus.toFixed(3));

chk('gpa: unweighted is the credit-weighted mean', G.unweighted, (3.7 + 3.3 + 4.0 + 3.0) / 4);
chk('gpa: weighted adds 1.0 for AP and 0.5 for honours', G.weighted, (4.7 + 3.3 + 4.5 + 3.0) / 4);
chk('gpa: the bonus is the difference', G.weightBonus, G.weighted - G.unweighted);
chk('gpa: credits total', G.totalCredits, 4, 0);
chk('gpa: every row counted', G.counted, 4, 0);

/* Credits must actually weight. A four-credit C and a one-credit A do not
   average to a B, and a calculator that says they do is flattering you. */
const heavy = gpa([
  { name: 'Big', credits: '4', grade: 'C', level: 'reg' },
  { name: 'Small', credits: '1', grade: 'A', level: 'reg' },
]);
chk('gpa: credits weight the average', heavy.unweighted, (2.0 * 4 + 4.0 * 1) / 5);
ok('gpa: which is not the naive mean of 3.0', Math.abs(heavy.unweighted - 3.0) > 0.4);

// Rows that cannot count must be skipped, not treated as zeros.
const messy = gpa([
  { name: 'Fine', credits: '3', grade: 'A', level: 'reg' },
  { name: 'No grade', credits: '3', grade: '', level: 'reg' },
  { name: 'No credits', credits: '', grade: 'A', level: 'reg' },
  { name: 'Pass/fail', credits: '0', grade: 'A', level: 'reg' },
]);
chk('gpa: unusable rows are skipped', messy.counted, 1, 0);
chk('gpa: and reported as skipped', messy.ignored, 3, 0);
chk('gpa: a skipped row is not a zero', messy.unweighted, 4.0);

// A+ must not be 4.3 — the error would inflate in the direction nobody checks.
chk('gpa: A+ counts 4.0, not 4.3', gpa([{ name: '', credits: '1', grade: 'A+', level: 'reg' }]).unweighted, 4.0);
ok('gpa: the scale tops out at 4.0', Math.max(...GRADES.map((g) => g.points)) === 4);
ok('gpa: exactly one level carries no bonus', LEVELS.filter((l) => l.bonus === 0).length === 1);
ok('gpa: an all-regular roster reports no weighting', gpa([{ name: '', credits: '1', grade: 'B', level: 'reg' }]).noWeighting);
ok('gpa: weighted can exceed 4.0, and that is correct',
  gpa([{ name: '', credits: '1', grade: 'A', level: 'ap' }]).weighted === 5.0);
chk('gpa: an empty roster is 0, not NaN', gpa([]).unweighted, 0);

/* Cumulative GPA cannot be the mean of two GPAs — it has to be credit
   weighted, and getting this wrong is the most common student error. */
chk('gpa: cumulative weights by credits', cumulative(3.0, 60, 4.0, 30), (3.0 * 60 + 4.0 * 30) / 90);
ok('gpa: which is not the average of the two', Math.abs(cumulative(3.0, 60, 4.0, 30) - 3.5) > 0.15);

/* =========================== final grade =========================== */
const comps = [
  { name: 'Homework', weight: '20', score: '92' },
  { name: 'Quizzes', weight: '15', score: '85' },
  { name: 'Midterm', weight: '25', score: '78' },
  { name: 'Final exam', weight: '40', score: '' },
];
const F = final(comps, 90);
console.log('\n--- final grade (the page defaults, target 90) ---');
console.log('  banked', F.earnedSoFar.toFixed(2), 'of 100 | standing', F.currentGrade.toFixed(1) + '%',
  '| final worth', F.remainingWeight + '%', '| need', F.needed.toFixed(1) + '%');

chk('final: banked points are score x weight', F.earnedSoFar, 0.92 * 20 + 0.85 * 15 + 0.78 * 25);
chk('final: the ungraded weight is the final', F.remainingWeight, 40);
/* Standing now is marks over weight GRADED — not over the whole course. This
   is the distinction people get wrong. */
chk('final: standing is over graded weight only', F.currentGrade, (F.earnedSoFar / 60) * 100);
ok('final: standing is not the banked points', Math.abs(F.currentGrade - F.earnedSoFar) > 20);
chk('final: needed solves the equation', F.needed, ((90 - F.earnedSoFar) / 40) * 100);
ok('final: this target is reachable', F.outcome === 'reachable');

// The two answers the tool exists to give.
const hard = final(comps, 99);
ok('final: an unreachable target says so', hard.outcome === 'impossible');
ok('final: and needs more than 100', hard.needed > 100);
chk('final: best possible is banked plus the whole final', hard.bestPossible, F.earnedSoFar + 40);
const easy = final(comps, 40);
ok('final: an already-secured grade says so', easy.outcome === 'secured');
ok('final: and needs zero or less', easy.needed <= 0);
chk('final: worst possible is the banked points', easy.worstPossible, F.earnedSoFar);

// No weight left is a real state — the course is over — not an error.
const done = final([{ name: 'All of it', weight: '100', score: '87' }], 90);
ok('final: a fully graded course reports no final', done.outcome === 'no-final');
chk('final: and its grade is what was scored', done.currentGrade, 87);
ok('final: needed is not a number when there is no final', Number.isNaN(done.needed));

// Rows missing a weight or a score cannot contribute.
const partial = final([
  { name: 'Graded', weight: '30', score: '80' },
  { name: 'No score yet', weight: '30', score: '' },
  { name: 'No weight', weight: '', score: '95' },
], 75);
chk('final: only fully specified rows count', partial.counted, 1, 0);
chk('final: ungraded weight rolls into the remainder', partial.remainingWeight, 70);

/* ============================ loan payoff ============================ */
const debts = [
  { name: 'Subsidised 2022', balance: '9500', rate: '4.99', minimum: '105' },
  { name: 'Unsubsidised 2023', balance: '11000', rate: '5.50', minimum: '120' },
  { name: 'Unsubsidised 2024', balance: '9000', rate: '6.53', minimum: '100' },
  { name: 'Private', balance: '6500', rate: '9.25', minimum: '85' },
];
const L = loans(debts, 200, 'avalanche');
console.log('\n--- loan payoff (the page defaults, $200 extra) ---');
console.log('  balance', money(L.totalBalance), '| blended', L.blendedRate.toFixed(2) + '%',
  '| range', L.lowestRate + '%-' + L.highestRate + '%');
console.log('  avalanche', L.avalanche.months, 'mo', money(L.avalanche.totalInterest),
  '| snowball', L.snowball.months, 'mo', money(L.snowball.totalInterest),
  '| minimum', L.minimum.months, 'mo', money(L.minimum.totalInterest));
console.log('  avalanche saves', money(L.vsSnowball), 'vs snowball and', money(L.vsMinimum), 'vs minimums only');

chk('loan: balance is the sum of the loans', L.totalBalance, 9500 + 11000 + 9000 + 6500, 0.01);
chk('loan: minimums are the sum of the minimums', L.totalMinimum, 105 + 120 + 100 + 85, 0.01);
chk('loan: blended rate is balance-weighted', L.blendedRate,
  (4.99 * 9500 + 5.50 * 11000 + 6.53 * 9000 + 9.25 * 6500) / 36000, 0.001);

/* Avalanche is arithmetically optimal — there is no ordering that beats it.
   If this ever fails, the simulation is wrong, not the theory. */
ok('loan: avalanche is never dearer than snowball', L.avalanche.totalInterest <= L.snowball.totalInterest + 0.01);
ok('loan: and never dearer than paying minimums', L.avalanche.totalInterest <= L.minimum.totalInterest + 0.01);
ok('loan: paying extra finishes sooner', L.avalanche.months <= L.minimum.months);
chk('loan: the saving against snowball is the difference',
  L.vsSnowball, L.snowball.totalInterest - L.avalanche.totalInterest, 0.01);

/* The strategies must actually differ when the highest rate is NOT the
   smallest balance. The page defaults happen to make them agree, which is a
   coincidence of the seed and would hide a broken strategy switch. */
const diverge = [
  { name: 'Big high-rate', balance: '22000', rate: '8.5', minimum: '240' },
  { name: 'Small low-rate', balance: '5000', rate: '3.5', minimum: '60' },
];
const D = loans(diverge, 250, 'avalanche');
ok('loan: strategies diverge when rate and size disagree', D.snowball.totalInterest > D.avalanche.totalInterest + 1);
ok('loan: avalanche clears the high-rate loan first', D.avalanche.order[0].name === 'Big high-rate');
ok('loan: snowball clears the small one first', D.snowball.order[0].name === 'Small low-rate');
ok('loan: and snowball is slower here', D.snowball.months > D.avalanche.months);

// Choosing a strategy must actually select it.
ok('loan: chosen follows the strategy', loans(diverge, 250, 'snowball').chosen.totalInterest === D.snowball.totalInterest);
ok('loan: minimum-only pays no extra', loans(diverge, 250, 'minimum').chosen.totalInterest === D.minimum.totalInterest);

/* A minimum below the month's interest means the balance grows forever. This
   is common on income-driven plans and invisible from a statement, so it has
   to be detected rather than silently simulated for sixty years. */
const drowning = loans([{ name: 'Bad', balance: '20000', rate: '9', minimum: '50' }], 0, 'minimum');
ok('loan: an under-water minimum is flagged', drowning.underwater.includes('Bad'));
ok('loan: and the loan never clears', drowning.minimum.neverPaysOff);

// A cleared loan must release its minimum into the next attack.
const cascade = loans([
  { name: 'Tiny', balance: '500', rate: '5', minimum: '100' },
  { name: 'Rest', balance: '12000', rate: '5', minimum: '130' },
], 0, 'avalanche');
ok('loan: the small loan clears first', cascade.avalanche.order[0].name === 'Tiny');
ok('loan: and the total still clears', !cascade.avalanche.neverPaysOff);

// Unusable rows are skipped rather than treated as zero-balance loans.
const junk = loans([
  { name: 'Real', balance: '5000', rate: '6', minimum: '80' },
  { name: 'No balance', balance: '', rate: '6', minimum: '80' },
  { name: 'No minimum', balance: '5000', rate: '6', minimum: '' },
], 0, 'avalanche');
chk('loan: unusable rows are skipped', junk.counted, 1, 0);
chk('loan: and reported', junk.ignored, 2, 0);
chk('loan: an empty list owes nothing', loans([], 100, 'avalanche').totalBalance, 0);

// The chart needs one balance point per month, starting at the full balance.
ok('loan: the balance series starts at the total', Math.abs(L.avalanche.balances[0] - L.totalBalance) < 0.01);
ok('loan: and ends at zero', L.avalanche.balances[L.avalanche.balances.length - 1] < 0.01);
ok('loan: the series never rises', L.avalanche.balances.every((b, i, a) => i === 0 || b <= a[i - 1] + 0.01));


/* ========================= cumulative GPA ========================= */
const terms = [
  { name: 'First year', credits: '30', gpa: '2.90' },
  { name: 'Second year', credits: '30', gpa: '3.20' },
];
const C = cumTerms(terms, 3.5, 15);
console.log('\n--- cumulative GPA (60 credits, target 3.50, 15 planned) ---');
console.log('  cumulative', C.cumulative.toFixed(3), '| needs', C.needed.toFixed(2),
  '|', C.outcome, '| best possible', C.bestPossible.toFixed(3));

chk('cum: weighted by credits, not averaged', C.cumulative, (2.90 * 30 + 3.20 * 30) / 60);
/* The error this tool exists to prevent. Equal credits make the two agree, so
   the divergent case has to be tested explicitly. */
const uneven = cumTerms([
  { name: 'Big', credits: '60', gpa: '3.00' },
  { name: 'Small', credits: '30', gpa: '4.00' },
], 3.5, 0);
chk('cum: 60 at 3.0 then 30 at 4.0 is 3.33', uneven.cumulative, (3.0 * 60 + 4.0 * 30) / 90);
ok('cum: which is NOT the average of 3.5', Math.abs(uneven.cumulative - 3.5) > 0.15);

chk('cum: solving for the coming term', C.needed, (3.5 * 75 - (2.90 * 30 + 3.20 * 30)) / 15);
ok('cum: a 3.5 is out of reach from 3.05 with 15 credits', C.outcome === 'impossible');
chk('cum: best possible assumes a perfect term',
  C.bestPossible, ((2.90 * 30 + 3.20 * 30) + 4 * 15) / 75);
ok('cum: and the best possible is below the target', C.bestPossible < 3.5);

const reachable = cumTerms(terms, 3.2, 15);
ok('cum: a nearer target is reachable', reachable.outcome === 'reachable');
ok('cum: and needs at most 4.0', reachable.needed <= 4);
/* 2.5 still needs 0.30 next term — a zero term would drop below it. A
   target is only 'already there' when even a zero cannot lose it. */
const held = cumTerms(terms, 2.4, 15);
ok('cum: a target already passed says so', held.outcome === 'already-there');
ok('cum: with no planned credits there is nothing to solve', cumTerms(terms, 3.5, 0).outcome === 'no-plan');
chk('cum: rows without a GPA are skipped',
  cumTerms([...terms, { name: 'Planned', credits: '15', gpa: '' }], 3.5, 15).counted, 2, 0);
chk('cum: an empty record is 0, not NaN', cumTerms([], 3.5, 15).cumulative, 0);

/* Dropping credits raises the bar rather than lowering it — the note on the
   page claims this, so it had better be true. */
ok('cum: fewer planned credits need a higher average',
  cumTerms(terms, 3.3, 9).needed > cumTerms(terms, 3.3, 18).needed);

/* ========================== scale converter ========================== */
console.log('\n--- scale converter ---');
const uk70 = toPoints('70', 'uk');
const us70 = toPoints('70', 'uspct');
console.log('  UK 70 =>', uk70.toFixed(2), 'pts | US 70 =>', us70.toFixed(2), 'pts');

/* The whole reason the tool exists: a UK 70 is a First, a US 70 is a C. If
   these ever converge, the converter has started lying about the thing it was
   built to prevent. */
ok('scale: a UK 70 is a First', uk70 >= 3.7);
ok('scale: a US 70 is not', us70 < 2.0);
ok('scale: and they are far apart', uk70 - us70 > 1.5);

chk('scale: UK 70 matches US 3.7', uk70, 3.70, 0.02);
ok('scale: ECTS cannot be derived from a mark',
  convert('3.7', 'us4').conversions.find((c) => c.scale === 'ects').notDerivable);
ok('scale: and returns nothing rather than guessing',
  convert('3.7', 'us4').conversions.find((c) => c.scale === 'ects').display === null);
ok('scale: rubbish input is rejected', !convert('abc', 'us4').valid);
ok('scale: out-of-range input is rejected', !convert('7', 'us4').valid);
ok('scale: 4.3 is clamped to the 4.0 ceiling', convert('4.3', 'us4').points === 4);

/* ==================== income-driven repayment ==================== */
const borrower = {
  balance: 42_000, rate: 6.53, agi: 52_000, householdSize: 1, dependents: 0,
  region: 'contiguous', borrowedFromJuly2026: false, preJuly2014: false,
};
const R = idr(borrower);
console.log('\n--- income-driven repayment ($42k at 6.53%, $52k AGI, household of 1) ---');
console.log('  poverty line', money(R.povertyLine), '| discretionary', money(R.discretionary),
  '| 10-year standard', money(R.standard.monthly) + '/mo');
for (const r of R.results) {
  console.log('   ', r.plan.short.padEnd(12), r.eligible
    ? money(r.monthly).padStart(6) + '/mo  total ' + money(r.totalPaid).padStart(8)
      + (r.forgiven ? '  forgiven ' + money(r.forgivenAmount) : '')
    : 'not available');
}

/* The 2026 figures, pinned. HHS reissues these every January and the plan
   rules changed twice in 2026, so a stale copy is the likeliest failure. */
chk('idr: 2026 poverty line, household of one', povertyLine(1), 15_960, 0);
chk('idr: household of four', povertyLine(4), 33_000, 0);
chk('idr: Alaska runs higher', povertyLine(1, 'alaska'), 19_950, 0);
chk('idr: Hawaii runs higher', povertyLine(1, 'hawaii'), 18_360, 0);
chk('idr: discretionary is AGI less 150% of the guideline', R.discretionary, 52_000 - 15_960 * 1.5);

/* Eligibility is the new thing and the whole reason the tool exists. */
ok('idr: SAVE is not offered', !PLANS.some((p) => p.id === 'save'));
ok('idr: RAP is closed to loans disbursed before July 2026',
  !R.results.find((r) => r.plan.id === 'rap').eligible);
const newBorrower = idr({ ...borrower, borrowedFromJuly2026: true });
ok('idr: and is the ONLY plan for loans from July 2026',
  newBorrower.eligible.length === 1 && newBorrower.eligible[0].plan.id === 'rap');
ok('idr: the older plans close to those borrowers',
  newBorrower.results.filter((r) => r.plan.id !== 'rap').every((r) => !r.eligible));
ok('idr: every ineligible plan explains why',
  R.results.filter((r) => !r.eligible).every((r) => r.ineligibleBecause.length > 20));

/* Borrowing before July 2014 puts you on the worse IBR terms — 15% and 25
   years — which is the largest single reason two identical balances differ. */
const older = idr({ ...borrower, preJuly2014: true });
ok('idr: a pre-2014 borrower gets the older IBR', older.results.find((r) => r.plan.id === 'ibr-old').eligible);
ok('idr: and not the newer one', !older.results.find((r) => r.plan.id === 'ibr-new').eligible);
ok('idr: the older IBR costs more each month',
  older.results.find((r) => r.plan.id === 'ibr-old').monthly
    > R.results.find((r) => r.plan.id === 'ibr-new').monthly);

/* No income-driven payment should ever exceed the ten-year standard. ICR is
   the one that can, which is why it carries a twelve-year cap. */
ok('idr: no eligible plan asks more than the standard plan',
  R.eligible.every((r) => r.monthly <= R.standard.monthly + 0.5));
chk('idr: the standard payment amortises over ten years', R.standard.months, 120, 1);
chk('idr: standardPayment agrees with the simulation',
  standardPayment(42_000, 6.53), R.standard.monthly, 0.01);

/* RAP's schedule, which is a band table rather than a discretionary formula. */
const rapLow = idr({ ...borrower, borrowedFromJuly2026: true, agi: 22_000 }).eligible[0];
const rapHigh = idr({ ...borrower, borrowedFromJuly2026: true, agi: 120_000 }).eligible[0];
chk('idr: RAP takes 2% of a $22,000 AGI', rapLow.monthly, (22_000 * 0.02) / 12, 0.01);
chk('idr: and 10% above $100,000', rapHigh.monthly, (120_000 * 0.10) / 12, 0.01);
/* Tested at an income high enough that the deduction does not hit the floor —
   at $22,000 two dependents would push the payment negative, which is what the
   floor is for and is asserted separately below. */
const rapMid = idr({ ...borrower, borrowedFromJuly2026: true, agi: 60_000 }).eligible[0];
const rapDeps = idr({ ...borrower, borrowedFromJuly2026: true, agi: 60_000, dependents: 2 }).eligible[0];
chk('idr: each dependent takes $50 off', rapDeps.monthly, rapMid.monthly - 100, 0.01);
ok('idr: and the deduction cannot drive a payment negative',
  idr({ ...borrower, borrowedFromJuly2026: true, agi: 22_000, dependents: 2 }).eligible[0].monthly === 10);
const rapFloor = idr({ ...borrower, borrowedFromJuly2026: true, agi: 12_000, dependents: 4 }).eligible[0];
chk('idr: but never below the $10 floor', rapFloor.monthly, 10, 0.01);

/* A payment below the interest is a real state — and RAP is the only plan
   that stops the balance growing when it happens. */
const broke = idr({ ...borrower, agi: 24_000 });
ok('idr: a low income leaves payments below interest',
  broke.eligible.some((r) => r.negativelyAmortising));
ok('idr: zero discretionary income gives a zero payment',
  idr({ ...borrower, agi: 20_000 }).results.find((r) => r.plan.id === 'ibr-new').monthly === 0);

// Forgiveness terms must match the plan definitions.
for (const r of R.results) {
  ok(`idr: ${r.plan.short} forgives at ${r.plan.forgivenessYears} years`,
    !r.forgiven || r.months === r.plan.forgivenessYears * 12);
}
chk('idr: an empty balance owes nothing', idr({ ...borrower, balance: 0 }).standard.monthly, 0);

/* ======================= 27: true cost of college ======================= */
/* Nothing here is snapshotted from the model. Every expectation is arrived at
   independently — by closed form where the model iterates, and by hand where
   the arithmetic is short enough to check on paper. */
const costBase = {
  netPricePerYear: 20_000, years: 4, scholarships: 0, contribution: 0,
  inflation: 0, loanRate: 6, loanYears: 10, earnings10: 60_000,
};
const CC = cost(costBase);
console.log('\n--- true cost of college ($20k net, four years, 6%) ---');
console.log('  total cost', money(CC.totalCost), '| borrowed', money(CC.totalBorrowed),
  '| owed at graduation', money(CC.debtAtGraduation), '| monthly', money(CC.monthlyPayment));

chk('cost: flat price, four years', CC.totalCost, 80_000);
chk('cost: borrowed is the unaided gap, uninflated by interest', CC.totalBorrowed, 80_000);

/* Interest starts on each year's borrowing when it is drawn, so the balance at
   graduation is the sum of each year's draw compounded for the years that
   remain: 20000 * (1.06 + 1.06^2 + 1.06^3 + 1.06^4). Worked by hand: 92,741.86. */
chk('cost: each year of borrowing compounds from the year it is drawn',
  CC.debtAtGraduation, 20_000 * (1.06 + 1.06 ** 2 + 1.06 ** 3 + 1.06 ** 4), 0.01);
chk('cost: which is 92,741.86', CC.debtAtGraduation, 92_741.8592, 0.01);
ok('cost: so more is owed at graduation than was borrowed',
  CC.debtAtGraduation > CC.totalBorrowed);

/* The payment is checked by amortising it rather than by re-running the same
   formula — paying it for the full term must clear the balance exactly. */
let bal = CC.debtAtGraduation;
for (let m = 0; m < costBase.loanYears * 12; m++) bal = bal * (1 + 0.06 / 12) - CC.monthlyPayment;
chk('cost: the payment amortises the balance to zero over the term', bal, 0, 0.01);
chk('cost: total repaid is every payment', CC.totalRepaid, CC.monthlyPayment * 120, 0.01);
chk('cost: interest is what is repaid above the balance',
  CC.totalInterest, CC.totalRepaid - CC.debtAtGraduation, 0.01);

// Inflation applies from the second year, not the first.
const infl = cost({ ...costBase, inflation: 5 });
chk('cost: year one is not inflated', infl.yearly[0], 20_000);
chk('cost: year four is three years of inflation', infl.yearly[3], 20_000 * 1.05 ** 3);
chk('cost: which is $23,152.50', infl.yearly[3], 23_152.5, 0.01);
ok('cost: inflation raises the total', infl.totalCost > CC.totalCost);

// Aid is applied per year, and cannot push borrowing below zero.
const aided = cost({ ...costBase, scholarships: 5_000, contribution: 5_000 });
chk('cost: aid reduces the gap year by year', aided.totalBorrowed, 40_000);
chk('cost: scholarships total across the degree', aided.totalScholarships, 20_000);
chk('cost: contributions total across the degree', aided.totalContribution, 20_000);

const covered = cost({ ...costBase, scholarships: 15_000, contribution: 10_000 });
chk('cost: aid above the price borrows nothing, never a negative', covered.totalBorrowed, 0);
chk('cost: and owes nothing at graduation', covered.debtAtGraduation, 0);
chk('cost: and pays nothing monthly', covered.monthlyPayment, 0);
chk('cost: and pays no interest', covered.totalInterest, 0);

// The earnings comparisons, and the fact that they vanish when earnings are unknown.
chk('cost: total cost as years of median earnings', CC.costAsYearsOfEarnings, 80_000 / 60_000);
chk('cost: payment as a share of monthly earnings',
  CC.paymentShareOfIncome, (CC.monthlyPayment / 5_000) * 100, 0.01);
ok('cost: debt above first-year earnings is flagged', CC.debtExceedsEarnings === true);
ok('cost: debt below it is not',
  cost({ ...costBase, netPricePerYear: 8_000 }).debtExceedsEarnings === false);

const blind = cost({ ...costBase, earnings10: null });
ok('cost: unknown earnings leaves every earnings figure null',
  blind.earnings10 === null && blind.paymentShareOfIncome === null
  && blind.costAsYearsOfEarnings === null && blind.debtExceedsEarnings === null);
ok('cost: and a zero is treated as unknown, not as zero earnings',
  cost({ ...costBase, earnings10: 0 }).earnings10 === null);

/* The page's FAQ claims borrowing one year of salary costs about 13% of gross
   monthly income, and that the 10% ceiling arrives at about three-quarters of
   a year's salary. Both are the model's own arithmetic, so both are checked. */
const atSalary = cost({
  ...costBase, netPricePerYear: 15_000, years: 1, inflation: 0, loanRate: 6, earnings10: 15_900,
});
chk('cost: borrowing one year of salary takes ~13% of gross',
  atSalary.paymentShareOfIncome, 13.32, 0.15);
const atThreeQuarters = cost({ ...costBase, netPricePerYear: 11_250, years: 1, earnings10: 15_900 });
chk('cost: three-quarters of salary is where 10% is crossed',
  atThreeQuarters.paymentShareOfIncome, 10, 0.15);

// A degree is at least one year long however the field is filled in.
chk('cost: zero years is treated as one', cost({ ...costBase, years: 0 }).yearly.length, 1, 0);
chk('cost: fractional years round', cost({ ...costBase, years: 4.4 }).yearly.length, 4, 0);

/* netPriceFor is the join between the reader's income band and the imported
   table, and the fallback matters: plenty of institutions publish an average
   but not a full breakdown. */
const withBands = {
  slug: 't', name: 'T', netPrice: 18_000,
  byIncome: { low: 9_000, lowMid: null, mid: 14_000, upperMid: null, high: 25_000 },
};
chk('cost: a published band is used', netPriceFor(withBands, 'low'), 9_000);
chk('cost: a missing band falls back to the average', netPriceFor(withBands, 'lowMid'), 18_000);
chk('cost: the top band is used', netPriceFor(withBands, 'high'), 25_000);

/* The claim the whole page rests on: the same institution charges different
   families very different prices. If that stopped being true of the imported
   data, the page would be making a point its own numbers do not support. */
const spread = COLLEGES
  .filter((c) => c.byIncome.low != null && c.byIncome.high != null)
  .map((c) => c.byIncome.high - c.byIncome.low)
  .sort((a, b) => b - a);
console.log(`  widest published low-to-high gap ${money(spread[0])}/yr,`,
  `median ${money(spread[Math.floor(spread.length / 2)])}/yr`);
ok('cost: the imported data shows a real price spread by income',
  spread.length > 100 && spread[Math.floor(spread.length / 2)] > 5_000);

/* ========================= 28: 529 / savings plan ========================= */
const savPlan = {
  currentBalance: 5_000, monthlyContribution: 150, lumpSum: 0, yearsUntilStart: 18,
  annualReturn: 6, annualCost: 30_000, yearsOfStudy: 4, costInflation: 5, targetShare: 33,
};
const SV = sav(savPlan);
console.log('\n--- 529 planner (18 years, $150/mo, 6% return) ---');
console.log('  projected', money(SV.projectedBalance), '| target', money(SV.target),
  '| shortfall', money(SV.shortfall), '| needs', money(SV.requiredMonthly) + '/mo');

/* The projection loops month by month; the check uses the closed form for a
   growing annuity, which is a genuinely different computation. */
const mRate = 0.06 / 12, mN = 18 * 12;
chk('529: the projection matches the annuity closed form',
  SV.projectedBalance, 5_000 * (1 + mRate) ** mN + 150 * (((1 + mRate) ** mN - 1) / mRate), 0.01);
chk('529: contributions are principal only', SV.totalContributed, 5_000 + 150 * 12 * 18);
chk('529: growth is everything above what was paid in',
  SV.growth, SV.projectedBalance - SV.totalContributed, 0.01);
/* At 6% over eighteen years growth does NOT overtake contributions — the
   multiple on a monthly annuity is only about 1.8 — but it gets close, which
   is the fact the page is built on. */
ok('529: roughly half the ending balance is growth, not money paid in',
  SV.growth / SV.projectedBalance > 0.4 && SV.growth / SV.projectedBalance < 0.6);

/* Cost inflates until the degree starts and then again each year of it. The
   trap is treating four years as four times year one, which understates it. */
chk('529: the cost of the degree sums each inflated year',
  SV.futureCost, 30_000 * (1.05 ** 18 + 1.05 ** 19 + 1.05 ** 20 + 1.05 ** 21), 0.01);
ok('529: which is more than four times the first year',
  SV.futureCost > 4 * 30_000 * 1.05 ** 18);
chk('529: the target is the chosen share of it', SV.target, SV.futureCost * 0.33, 0.01);
chk('529: shortfall is the gap to the target', SV.shortfall, SV.target - SV.projectedBalance, 0.01);
ok('529: a shortfall means it is not covered', SV.covered === false && SV.surplus === 0);

/* The strongest check available: feed the required contribution back in and
   the projection must land on the target. */
const solved = sav({ ...savPlan, monthlyContribution: SV.requiredMonthly });
chk('529: contributing the required amount lands exactly on the target',
  solved.projectedBalance, SV.target, 0.01);
ok('529: and then it is covered', solved.covered === true);
chk('529: with no shortfall left', solved.shortfall, 0, 0.01);

const over = sav({ ...savPlan, monthlyContribution: SV.requiredMonthly + 50 });
ok('529: contributing more produces a surplus, not a negative shortfall',
  over.surplus > 0 && over.shortfall === 0 && over.covered === true);

// Waiting is the point of the page, so the figure behind it is pinned.
chk('529: the cost of waiting is the extra needed over one fewer year',
  SV.costOfWaitingAYear,
  requiredMonthly(SV.target, 5_000, 17, 6) - requiredMonthly(SV.target, 5_000, 18, 6), 0.01);
ok('529: and waiting always costs more, never less', SV.costOfWaitingAYear > 0);
console.log(`  waiting one year adds ${money(SV.costOfWaitingAYear)}/mo to what is needed`);

// A lump sum today is not the same as the same money contributed later.
const lump = sav({ ...savPlan, lumpSum: 20_000 });
ok('529: a lump sum today compounds for the whole period',
  lump.projectedBalance - SV.projectedBalance > 20_000 * 1.9);
ok('529: and lowers what is needed monthly', lump.requiredMonthly < SV.requiredMonthly);

// The degenerate cases have to behave rather than divide by zero.
const flat = sav({ ...savPlan, annualReturn: 0, currentBalance: 0, yearsUntilStart: 10 });
chk('529: a zero return is just the contributions', flat.projectedBalance, 150 * 120, 0.01);
chk('529: and the required amount divides evenly',
  flat.requiredMonthly, flat.target / 120, 0.01);
const now = sav({ ...savPlan, yearsUntilStart: 0 });
chk('529: starting today projects the opening balance', now.projectedBalance, 5_000);
chk('529: and the whole remaining target is needed outright',
  now.requiredMonthly, now.target - 5_000, 0.01);
chk('529: with no year to wait, waiting costs nothing', now.costOfWaitingAYear, 0);
chk('529: a funded target needs nothing more',
  requiredMonthly(10_000, 50_000, 10, 6), 0);

chk('529: one balance is recorded per year, plus the opening one',
  SV.balances.length, 19, 0);
chk('529: the first balance is the opening one', SV.balances[0], 5_000);
chk('529: the last is the projection', SV.balances[18], SV.projectedBalance, 0.01);
ok('529: the balance never falls with a positive return and contributions',
  SV.balances.every((b, i) => i === 0 || b > SV.balances[i - 1]));

/* The gift figures come from the data file and drive a warning on the page,
   so the boundary is checked on both sides of it. */
chk('529: the exclusion is the verified figure', SV.annualExclusion, GIFT_2026.annualExclusion);
chk('529: the five-year election is five of them',
  SV.fiveYearElection, GIFT_2026.annualExclusion * 5);
ok('529: contributing under the exclusion raises no flag',
  sav({ ...savPlan, monthlyContribution: Math.floor(GIFT_2026.annualExclusion / 12) })
    .overExclusion === false);
ok('529: contributing over it does',
  sav({ ...savPlan, monthlyContribution: Math.ceil(GIFT_2026.annualExclusion / 12) + 1 })
    .overExclusion === true);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
