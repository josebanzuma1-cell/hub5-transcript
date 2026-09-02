/* Tool 26 — income-driven repayment, compared.

   This tool exists because the ground moved. SAVE ended by court order in
   March 2026; RAP arrived in July. A borrower searching today will find
   calculators still offering a plan that no longer exists, and will not find
   the one they may be required to use.

   The eligibility question is therefore load-bearing and new: for loans first
   disbursed on or after 1 July 2026, RAP is the ONLY income-driven plan. For
   loans before that date, RAP is closed and the older plans remain. A tool
   that shows all five to everyone is showing most people at least one plan
   they cannot have. */
import { PLANS, RAP_BANDS, RAP_RULES, povertyLine, type PlanId, type RepaymentPlan } from '@data/student-aid';

export interface IdrInputs {
  balance: number;
  rate: number;
  agi: number;
  householdSize: number;
  dependents: number;
  region: 'contiguous' | 'alaska' | 'hawaii';
  /** true when every loan was first disbursed on or after 1 July 2026 */
  borrowedFromJuly2026: boolean;
  /** true when the borrower had a balance outstanding before 1 July 2014 */
  preJuly2014: boolean;
}

export interface PlanResult {
  plan: RepaymentPlan;
  eligible: boolean;
  ineligibleBecause: string;
  monthly: number;
  /** what the payment would be before any cap or floor */
  uncapped: number;
  /** months until the balance clears, or until forgiveness */
  months: number;
  totalPaid: number;
  totalInterest: number;
  /** balance written off at the end of the term, if any */
  forgiven: boolean;
  forgivenAmount: number;
  /** true when the payment does not cover the month's interest */
  negativelyAmortising: boolean;
}

export interface IdrModel {
  standard: { monthly: number; months: number; totalPaid: number; totalInterest: number };
  results: PlanResult[];
  eligible: PlanResult[];
  best: PlanResult | null;
  lowestPayment: PlanResult | null;
  discretionary: number;
  povertyLine: number;
  agi: number;
  /** RAP-only borrowers have no choice to make, and should be told so */
  rapOnly: boolean;
}

/** The ten-year standard plan — the benchmark every IDR plan is measured against. */
export function standardPayment(balance: number, annualRate: number, years = 10): number {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (balance <= 0) return 0;
  if (r === 0) return balance / n;
  return (balance * r) / (1 - Math.pow(1 + r, -n));
}

function rapMonthly(agi: number, dependents: number): number {
  if (agi <= 10_000) {
    return Math.max(RAP_RULES.minMonthly, RAP_RULES.floorAnnual / 12 - dependents * RAP_RULES.perDependentMonthly);
  }
  const band = RAP_BANDS.find((b) => b.upTo === null || agi <= b.upTo) ?? RAP_BANDS[RAP_BANDS.length - 1];
  const gross = (agi * (band.rate / 100)) / 12;
  return Math.max(RAP_RULES.minMonthly, gross - dependents * RAP_RULES.perDependentMonthly);
}

/* Simulate a plan to its end: either the balance clears, or the term runs out
   and the remainder is forgiven. Payments are recalculated once a year in
   reality; this holds income flat, which is stated on the page — modelling
   income growth would mean inventing a career. */
function simulate(
  balance: number, annualRate: number, monthly: number, termYears: number,
  rapSubsidy: boolean,
): Omit<PlanResult, 'plan' | 'eligible' | 'ineligibleBecause' | 'uncapped' | 'monthly'> {
  const r = annualRate / 100 / 12;
  const maxMonths = termYears * 12;
  let bal = balance;
  let paid = 0;
  let interest = 0;
  let month = 0;
  let negative = false;

  while (bal > 0.005 && month < maxMonths) {
    month++;
    const int = bal * r;
    if (monthly < int) negative = true;

    if (rapSubsidy) {
      /* RAP waives the interest a payment does not cover, and guarantees
         principal falls by at least what was paid, up to $50. Both are real
         provisions and both change the answer materially at low incomes. */
      const covered = Math.min(monthly, int);
      interest += covered;
      let principal = monthly - covered;
      const match = Math.min(RAP_RULES.principalMatchMonthly, Math.max(0, monthly - principal));
      principal += match;
      bal -= principal;
      paid += monthly;
    } else {
      interest += int;
      bal += int;
      const pay = Math.min(monthly, bal);
      bal -= pay;
      paid += pay;
    }
  }

  return {
    months: month,
    totalPaid: paid,
    totalInterest: interest,
    forgiven: bal > 0.005,
    forgivenAmount: Math.max(0, bal),
    negativelyAmortising: negative,
  };
}

export function compute(v: IdrInputs): IdrModel {
  const balance = Math.max(0, v.balance);
  const agi = Math.max(0, v.agi);
  const pov = povertyLine(v.householdSize, v.region);
  const standardMonthly = standardPayment(balance, v.rate);
  const std = simulate(balance, v.rate, standardMonthly, 10, false);

  const results: PlanResult[] = PLANS.map((plan) => {
    /* Eligibility first, because an ineligible plan should not be shown with
       a tempting number beside it. */
    let eligible = true;
    let because = '';
    if (plan.loansFrom && !v.borrowedFromJuly2026) {
      eligible = false;
      because = 'Only open to loans first disbursed on or after 1 July 2026.';
    }
    if (plan.loansBefore && v.borrowedFromJuly2026) {
      eligible = false;
      because = 'Closed to loans first disbursed on or after 1 July 2026 — those borrowers use RAP.';
    }
    if (plan.id === 'ibr-old' && !v.preJuly2014) {
      eligible = false;
      because = 'Only for borrowers who already had a balance outstanding before 1 July 2014.';
    }
    if (plan.id === 'ibr-new' && v.preJuly2014) {
      eligible = false;
      because = 'Only for borrowers with no outstanding balance as of 1 July 2014.';
    }
    if (plan.id === 'paye' && v.preJuly2014) {
      eligible = false;
      because = 'PAYE requires no outstanding balance as of 1 October 2007 and a disbursement after 1 October 2011.';
    }

    let uncapped: number;
    if (plan.basis === 'agi') {
      uncapped = rapMonthly(agi, v.dependents);
    } else {
      const protectedIncome = pov * (plan.povertyMultiple ?? 1.5);
      const discretionary = Math.max(0, agi - protectedIncome);
      uncapped = (discretionary * ((plan.rate ?? 10) / 100)) / 12;
    }
    /* ICR is the lesser of 20% of discretionary income and what a twelve-year
       fixed schedule would charge. The statute adjusts that second figure by
       an income percentage factor published annually; this applies the plain
       twelve-year payment instead, which is stated on the page. Without the
       cap at all, ICR came out ABOVE the ten-year standard payment, which no
       income-driven plan should ever do. */
    const monthly = plan.id === 'icr'
      ? Math.min(uncapped, standardPayment(balance, v.rate, 12))
      : plan.cappedAtStandard ? Math.min(uncapped, standardMonthly) : uncapped;
    const sim = simulate(balance, v.rate, monthly, plan.forgivenessYears, plan.id === 'rap');

    return { plan, eligible, ineligibleBecause: because, monthly, uncapped, ...sim };
  });

  const eligible = results.filter((r) => r.eligible);
  const best = eligible.length
    ? eligible.reduce((a, b) => (a.totalPaid <= b.totalPaid ? a : b)) : null;
  const lowestPayment = eligible.length
    ? eligible.reduce((a, b) => (a.monthly <= b.monthly ? a : b)) : null;

  return {
    standard: { monthly: standardMonthly, months: std.months, totalPaid: std.totalPaid, totalInterest: std.totalInterest },
    results, eligible, best, lowestPayment,
    discretionary: Math.max(0, agi - pov * 1.5),
    povertyLine: pov,
    agi,
    rapOnly: v.borrowedFromJuly2026,
  };
}
