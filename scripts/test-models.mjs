/* Model checks. Run: npm test

   Every figure quoted in page prose is printed here first — a worked example
   written by hand drifts from the model within one refactor, and a wrong
   number in prose is indistinguishable from a wrong number in the calculator
   to the person reading it. */
import { compute as gpa, cumulative, GRADES, LEVELS } from '../src/lib/tools/gpa.ts';
import { computeWith as final } from '../src/lib/tools/final-grade.ts';
import { computeWith as loans } from '../src/lib/tools/loan-payoff.ts';

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
