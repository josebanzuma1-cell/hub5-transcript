/* Federal student aid figures — poverty guidelines and repayment plan rules.

   VERIFIED against the primary sources. Both change annually, and the
   repayment landscape in particular changed more in 2026 than in the previous
   decade, so the checked-on date matters more here than almost anywhere else
   in the portfolio. */
import type { Verified } from './types';

const CHECKED = '2026-09-02';

/* HHS publishes the guidelines as a base for a household of one plus a flat
   amount per additional person, which is why they are stored that way rather
   than as a table — a table would invite someone to extend it by guessing. */
export interface PovertyScale {
  /** annual guideline for a household of one */
  base: number;
  /** added for each additional person */
  perPerson: number;
}

export const POVERTY_2026: Record<'contiguous' | 'alaska' | 'hawaii', PovertyScale> = {
  contiguous: { base: 15_960, perPerson: 5_680 },
  alaska:     { base: 19_950, perPerson: 7_100 },
  hawaii:     { base: 18_360, perPerson: 6_530 },
};

export const POVERTY_VERIFIED: Verified = {
  checkedOn: CHECKED,
  source:
    'HHS ASPE, "2026 Poverty Guidelines" detailed tables (48 contiguous states and DC, '
    + 'Alaska, and Hawaii), published in the Federal Register 15 January 2026',
  by: 'BAMU',
};

export function povertyLine(householdSize: number, region: keyof typeof POVERTY_2026 = 'contiguous'): number {
  const s = POVERTY_2026[region];
  const n = Math.max(1, Math.floor(householdSize));
  return s.base + (n - 1) * s.perPerson;
}

/* ============================================================
   Repayment plans.

   The 2026 landscape is not the one most calculators on the web still model,
   and the difference is not cosmetic:

     SAVE ended by court order on 10 March 2026 and is gone. Any tool still
       offering it is describing a plan nobody can enrol in.
     RAP — the Repayment Assistance Plan — arrives 1 July 2026 and is the ONLY
       income-driven plan available to a borrower whose loans were all first
       disbursed on or after that date.
     IBR, PAYE and ICR remain, but only for loans disbursed before 1 July 2026.

   So eligibility here depends on WHEN the money was borrowed, which is a
   question no pre-2026 calculator had to ask.
   ============================================================ */

export type PlanId = 'ibr-old' | 'ibr-new' | 'paye' | 'icr' | 'rap';

export interface RepaymentPlan {
  id: PlanId;
  name: string;
  /** short label for a comparison row */
  short: string;
  /** 'discretionary' plans take a share of income above a poverty multiple;
   *  RAP takes a share of TOTAL adjusted gross income instead. */
  basis: 'discretionary' | 'agi';
  /** multiple of the poverty guideline protected from the calculation */
  povertyMultiple?: number;
  /** share of the relevant income, as a percentage */
  rate?: number;
  /** years of qualifying payments before the balance is forgiven */
  forgivenessYears: number;
  /** only open to loans first disbursed before this date */
  loansBefore?: string;
  /** only open to loans first disbursed on or after this date */
  loansFrom?: string;
  /** payment can never exceed what the 10-year standard plan would charge */
  cappedAtStandard: boolean;
  note: string;
}

export const PLANS: RepaymentPlan[] = [
  {
    id: 'ibr-old', name: 'Income-Based Repayment (borrowed before July 2014)', short: 'IBR (older)',
    basis: 'discretionary', povertyMultiple: 1.5, rate: 15, forgivenessYears: 25,
    loansBefore: '2026-07-01', cappedAtStandard: true,
    note: 'For borrowers with a loan balance outstanding before 1 July 2014. Fifteen per cent of discretionary income and twenty-five years, both worse than the newer version — which is why the date you first borrowed matters.',
  },
  {
    id: 'ibr-new', name: 'Income-Based Repayment (new borrowers)', short: 'IBR (newer)',
    basis: 'discretionary', povertyMultiple: 1.5, rate: 10, forgivenessYears: 20,
    loansBefore: '2026-07-01', cappedAtStandard: true,
    note: 'For borrowers with no outstanding balance as of 1 July 2014. The only income-driven plan that also accepts FFEL loans.',
  },
  {
    id: 'paye', name: 'Pay As You Earn', short: 'PAYE',
    basis: 'discretionary', povertyMultiple: 1.5, rate: 10, forgivenessYears: 20,
    loansBefore: '2026-07-01', cappedAtStandard: true,
    note: 'Ten per cent of discretionary income over twenty years, with the payment capped at the ten-year standard amount.',
  },
  {
    id: 'icr', name: 'Income-Contingent Repayment', short: 'ICR',
    basis: 'discretionary', povertyMultiple: 1.0, rate: 20, forgivenessYears: 25,
    loansBefore: '2026-07-01', cappedAtStandard: false,
    note: 'Protects only 100% of the poverty guideline rather than 150%, and takes twenty per cent of what is left — the least generous of the older plans, and usually a last resort. It is the only plan open to a Parent PLUS borrower who consolidates.',
  },
  {
    id: 'rap', name: 'Repayment Assistance Plan', short: 'RAP',
    basis: 'agi', forgivenessYears: 30,
    loansFrom: '2026-07-01', cappedAtStandard: false,
    note: 'Available from 1 July 2026, and the only income-driven plan for loans first disbursed on or after that date. Charges a share of TOTAL adjusted gross income rather than discretionary income, so it protects nothing at the bottom — but it waives unpaid interest and matches principal, which the older plans do not.',
  },
];

/* RAP's schedule: a flat $10 a month at the bottom, then one percentage point
   per $10,000 band of AGI up to ten per cent. */
export const RAP_BANDS: Array<{ upTo: number | null; rate: number }> = [
  { upTo: 10_000, rate: 0 },   // flat $120 a year, handled separately
  { upTo: 20_000, rate: 1 },
  { upTo: 30_000, rate: 2 },
  { upTo: 40_000, rate: 3 },
  { upTo: 50_000, rate: 4 },
  { upTo: 60_000, rate: 5 },
  { upTo: 70_000, rate: 6 },
  { upTo: 80_000, rate: 7 },
  { upTo: 90_000, rate: 8 },
  { upTo: 100_000, rate: 9 },
  { upTo: null, rate: 10 },
];

export const RAP_RULES = {
  /** annual payment for an AGI at or below the first band */
  floorAnnual: 120,
  /** monthly floor after the dependent reduction */
  minMonthly: 10,
  /** monthly reduction per dependent claimed */
  perDependentMonthly: 50,
  /** government matches principal by at least the amount paid, up to this */
  principalMatchMonthly: 50,
  /** unpaid interest is waived rather than capitalised */
  waivesUnpaidInterest: true,
};

export const PLANS_VERIFIED: Verified = {
  checkedOn: CHECKED,
  source:
    'Federal Student Aid (studentaid.gov) income-driven repayment pages for IBR, PAYE and ICR; '
    + 'Congressional Research Service IF13075 and Federal Student Aid servicer guidance for the '
    + 'Repayment Assistance Plan under P.L. 119-21; SAVE confirmed ended by court order 10 March 2026',
  by: 'BAMU',
};
