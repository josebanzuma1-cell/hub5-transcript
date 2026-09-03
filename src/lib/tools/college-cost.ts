/* Tool 27 — what a degree actually costs, and what it returns.

   The sticker price is not the price. Almost nobody pays it, the gap between
   sticker and net varies enormously by institution, and — the part that
   surprises people most — net price varies by FAMILY INCOME at the same
   institution, sometimes by tens of thousands of pounds a year. A well-endowed
   private university can be cheaper for a low-income family than the state
   school down the road.

   So this works from the published net price for the reader's income band
   rather than from the sticker, and shows the sticker only to make the point
   that it was never the number. */
import type { College } from '@data/colleges';

export type IncomeBand = 'low' | 'lowMid' | 'mid' | 'upperMid' | 'high';

export const INCOME_BANDS: Array<{ id: IncomeBand; label: string }> = [
  { id: 'low',      label: 'Under $30,000' },
  { id: 'lowMid',   label: '$30,001 – $48,000' },
  { id: 'mid',      label: '$48,001 – $75,000' },
  { id: 'upperMid', label: '$75,001 – $110,000' },
  { id: 'high',     label: 'Over $110,000' },
];

export interface CostInputs {
  /** net price for one year, before any of the reader's own aid */
  netPricePerYear: number;
  years: number;
  /** grants and scholarships the reader expects, per year */
  scholarships: number;
  /** family or savings contribution, per year */
  contribution: number;
  /** annual cost inflation applied to years after the first */
  inflation: number;
  /** rate on whatever has to be borrowed */
  loanRate: number;
  /** repayment term for the resulting debt */
  loanYears: number;
  /** median earnings ten years after entry, where known */
  earnings10: number | null;
}

export interface CostModel {
  /** cost per year after inflation, before the reader's own aid */
  yearly: number[];
  totalCost: number;
  totalScholarships: number;
  totalContribution: number;
  /** what has to be borrowed across the whole degree */
  totalBorrowed: number;
  /** balance at graduation, including interest accrued while studying */
  debtAtGraduation: number;
  monthlyPayment: number;
  totalRepaid: number;
  totalInterest: number;
  earnings10: number | null;
  /** the monthly payment as a share of monthly median earnings */
  paymentShareOfIncome: number | null;
  /** years of median earnings the total cost represents */
  costAsYearsOfEarnings: number | null;
  /** true when debt at graduation exceeds first-year median earnings, the
   *  rule of thumb most advisers use */
  debtExceedsEarnings: boolean | null;
}

const pmt = (balance: number, annualRate: number, years: number): number => {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (balance <= 0 || n <= 0) return 0;
  if (r === 0) return balance / n;
  return (balance * r) / (1 - Math.pow(1 + r, -n));
};

export function compute(v: CostInputs): CostModel {
  const years = Math.max(1, Math.round(v.years));
  const yearly: number[] = [];
  for (let y = 0; y < years; y++) {
    yearly.push(v.netPricePerYear * Math.pow(1 + v.inflation / 100, y));
  }
  const totalCost = yearly.reduce((t, y) => t + y, 0);
  const totalScholarships = v.scholarships * years;
  const totalContribution = v.contribution * years;

  /* Borrowing is worked out year by year, because interest starts accruing on
     each year's borrowing from the moment it is drawn — not at graduation.
     Treating the whole balance as if it appeared on the last day understates
     the debt, and unsubsidised loans are the common case. */
  let debt = 0;
  let borrowed = 0;
  for (let y = 0; y < years; y++) {
    const gap = Math.max(0, yearly[y] - v.scholarships - v.contribution);
    borrowed += gap;
    debt += gap;
    debt *= 1 + v.loanRate / 100; // a year of interest on the running balance
  }

  const monthly = pmt(debt, v.loanRate, v.loanYears);
  const totalRepaid = monthly * v.loanYears * 12;

  const e = v.earnings10 && v.earnings10 > 0 ? v.earnings10 : null;
  return {
    yearly,
    totalCost,
    totalScholarships,
    totalContribution,
    totalBorrowed: borrowed,
    debtAtGraduation: debt,
    monthlyPayment: monthly,
    totalRepaid,
    totalInterest: Math.max(0, totalRepaid - debt),
    earnings10: e,
    paymentShareOfIncome: e ? (monthly / (e / 12)) * 100 : null,
    costAsYearsOfEarnings: e ? totalCost / e : null,
    debtExceedsEarnings: e ? debt > e : null,
  };
}

/** Net price for a family income band, falling back to the average. */
export function netPriceFor(c: College, band: IncomeBand): number {
  return c.byIncome[band] ?? c.netPrice;
}
