/* Tool 28 — saving for a degree.

   The point of this one is the shape of the answer rather than the answer.
   Compound growth over eighteen years does most of the work, and every year
   you delay costs far more than the contributions you skipped — which is
   obvious stated baldly and startling when you see the numbers.

   It deliberately does NOT tell you to save the whole cost. Aiming for a third
   from savings, a third from current income during the degree, and a third
   from borrowing is a widely used planning rule and a far more achievable
   target than the full amount, which most families cannot reach and which
   discourages them from starting at all. */
import { GIFT_2026 } from '@data/student-aid';

export interface SavingsInputs {
  currentBalance: number;
  monthlyContribution: number;
  /** one-off lump sum added today, e.g. a grandparent's superfunding */
  lumpSum: number;
  yearsUntilStart: number;
  annualReturn: number;
  /** annual cost of the degree in today's money */
  annualCost: number;
  yearsOfStudy: number;
  /** how fast the cost of the degree itself rises */
  costInflation: number;
  /** share of the total the family intends to cover from savings, 0-100 */
  targetShare: number;
}

export interface SavingsModel {
  projectedBalance: number;
  totalContributed: number;
  growth: number;
  /** the full cost of the degree in the year it starts, inflated */
  futureCost: number;
  /** the part being aimed at */
  target: number;
  shortfall: number;
  surplus: number;
  covered: boolean;
  /** monthly contribution that would exactly meet the target */
  requiredMonthly: number;
  /** what waiting a year costs in extra required monthly contribution */
  costOfWaitingAYear: number;
  /** balance year by year, for the chart */
  balances: number[];
  /** contributions above this are a reportable gift */
  annualExclusion: number;
  fiveYearElection: number;
  overExclusion: boolean;
}

function project(balance: number, monthly: number, years: number, annualReturn: number): number[] {
  const r = annualReturn / 100 / 12;
  const out = [balance];
  let b = balance;
  for (let m = 1; m <= Math.round(years * 12); m++) {
    b = b * (1 + r) + monthly;
    if (m % 12 === 0) out.push(b);
  }
  return out;
}

/** Monthly contribution needed to reach a target from a starting balance. */
export function requiredMonthly(
  target: number, start: number, years: number, annualReturn: number,
): number {
  const r = annualReturn / 100 / 12;
  const n = Math.round(years * 12);
  if (n <= 0) return Math.max(0, target - start);
  const grown = start * Math.pow(1 + r, n);
  const need = target - grown;
  if (need <= 0) return 0;
  if (r === 0) return need / n;
  return need / ((Math.pow(1 + r, n) - 1) / r);
}

export function compute(v: SavingsInputs): SavingsModel {
  const years = Math.max(0, v.yearsUntilStart);
  const start = v.currentBalance + v.lumpSum;
  const balances = project(start, v.monthlyContribution, years, v.annualReturn);
  const projected = balances[balances.length - 1] ?? start;
  const contributed = start + v.monthlyContribution * 12 * years;

  /* Cost inflates until the degree STARTS, then each subsequent year costs
     more again. Summing the years properly matters: treating four years as
     four times year one understates the total. */
  let futureCost = 0;
  for (let y = 0; y < Math.max(1, Math.round(v.yearsOfStudy)); y++) {
    futureCost += v.annualCost * Math.pow(1 + v.costInflation / 100, years + y);
  }
  const target = futureCost * (v.targetShare / 100);
  const gap = target - projected;

  return {
    projectedBalance: projected,
    totalContributed: contributed,
    growth: Math.max(0, projected - contributed),
    futureCost,
    target,
    shortfall: Math.max(0, gap),
    surplus: Math.max(0, -gap),
    covered: gap <= 0,
    requiredMonthly: requiredMonthly(target, start, years, v.annualReturn),
    costOfWaitingAYear: years > 1
      ? requiredMonthly(target, start, years - 1, v.annualReturn)
        - requiredMonthly(target, start, years, v.annualReturn)
      : 0,
    balances,
    annualExclusion: GIFT_2026.annualExclusion,
    fiveYearElection: GIFT_2026.fiveYearElection,
    overExclusion: v.monthlyContribution * 12 > GIFT_2026.annualExclusion,
  };
}
