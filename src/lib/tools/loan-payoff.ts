/* Tool 25 — student loan payoff.

   Loans are entered individually rather than as one blended balance, and that
   is the whole point of the tool. A borrower with $18,000 at 4.5% and $9,000
   at 7.05% does not have $27,000 at 5.3%: the order of attack changes the
   total interest by a meaningful amount, and a blended balance makes that
   decision invisible.

   Three strategies are compared because two of them are widely recommended
   and they disagree:

     avalanche  highest rate first — always the cheapest, arithmetically
     snowball   smallest balance first — clears individual loans sooner, which
                is worth something real that arithmetic does not capture
     minimum    what happens if nothing changes

   The tool reports what snowball COSTS rather than dismissing it. Somebody who
   keeps going because a loan disappeared in month nine has done better than
   somebody who optimised and gave up. */

export interface Loan {
  name: string;
  balance: string;
  rate: string;
  minimum: string;
}

export type Strategy = 'avalanche' | 'snowball' | 'minimum';

export interface PayoffResult {
  months: number;
  totalInterest: number;
  totalPaid: number;
  /** month each loan cleared, in the order they cleared */
  order: Array<{ name: string; month: number; interest: number }>;
  /** balance remaining at each month, for the chart */
  balances: number[];
  /** true when the minimum payments do not cover the interest */
  neverPaysOff: boolean;
}

export interface LoanModel {
  avalanche: PayoffResult;
  snowball: PayoffResult;
  minimum: PayoffResult;
  chosen: PayoffResult;
  strategy: Strategy;
  totalBalance: number;
  /** weighted average rate — shown so the reader can see what a blended
   *  balance would have hidden */
  blendedRate: number;
  highestRate: number;
  lowestRate: number;
  totalMinimum: number;
  extra: number;
  /** what avalanche saves against snowball, and against minimum only */
  vsSnowball: number;
  vsMinimum: number;
  monthsSavedVsMinimum: number;
  counted: number;
  ignored: number;
  /** a minimum payment that does not cover the month's interest */
  underwater: string[];
}

interface Live { name: string; bal: number; rate: number; min: number; interest: number }

const MAX_MONTHS = 12 * 60; // 60 years; past this the loan does not pay off

function simulate(loans: Live[], extra: number, strategy: Strategy): PayoffResult {
  const live = loans.map((l) => ({ ...l }));
  const order: PayoffResult['order'] = [];
  const balances: number[] = [live.reduce((t, l) => t + l.bal, 0)];
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;

  while (live.some((l) => l.bal > 0.005) && month < MAX_MONTHS) {
    month++;
    let pool = extra;

    // Interest first, then the minimums.
    for (const l of live) {
      if (l.bal <= 0) continue;
      const int = l.bal * (l.rate / 100 / 12);
      l.bal += int;
      l.interest += int;
      totalInterest += int;
    }
    for (const l of live) {
      if (l.bal <= 0) continue;
      const pay = Math.min(l.min, l.bal);
      l.bal -= pay;
      totalPaid += pay;
      // A cleared loan frees its minimum for the rest of the month's attack —
      // this is the snowball effect, and it applies to every strategy.
      if (l.bal <= 0.005) pool += l.min - pay;
    }

    if (strategy !== 'minimum' && pool > 0) {
      const targets = live.filter((l) => l.bal > 0.005).sort((a, b) =>
        strategy === 'avalanche' ? b.rate - a.rate || a.bal - b.bal : a.bal - b.bal || b.rate - a.rate);
      for (const t of targets) {
        if (pool <= 0) break;
        const pay = Math.min(pool, t.bal);
        t.bal -= pay;
        pool -= pay;
        totalPaid += pay;
      }
    }

    for (const l of live) {
      if (l.bal <= 0.005 && !order.some((o) => o.name === l.name)) {
        order.push({ name: l.name, month, interest: l.interest });
        l.bal = 0;
      }
    }
    balances.push(live.reduce((t, l) => t + Math.max(0, l.bal), 0));
  }

  return {
    months: month,
    totalInterest,
    totalPaid,
    order,
    balances,
    neverPaysOff: month >= MAX_MONTHS,
  };
}

export function computeWith(rows: Loan[], extra: number, strategy: Strategy): LoanModel {
  const live: Live[] = [];
  let ignored = 0;
  const underwater: string[] = [];

  rows.forEach((r, i) => {
    const bal = Number(String(r.balance).replace(/[^\d.]/g, ''));
    const rate = Number(String(r.rate).replace(/[^\d.]/g, ''));
    const min = Number(String(r.minimum).replace(/[^\d.]/g, ''));
    if (!(bal > 0) || !Number.isFinite(rate) || !(min > 0)) { ignored++; return; }
    const name = r.name?.trim() || `Loan ${i + 1}`;
    // A minimum below the first month's interest means the balance grows.
    if (min <= bal * (rate / 100 / 12)) underwater.push(name);
    live.push({ name, bal, rate, min, interest: 0 });
  });

  const totalBalance = live.reduce((t, l) => t + l.bal, 0);
  const totalMinimum = live.reduce((t, l) => t + l.min, 0);
  const blendedRate = totalBalance > 0
    ? live.reduce((t, l) => t + l.rate * l.bal, 0) / totalBalance : 0;

  const avalanche = simulate(live, extra, 'avalanche');
  const snowball = simulate(live, extra, 'snowball');
  const minimum = simulate(live, 0, 'minimum');
  const chosen = strategy === 'snowball' ? snowball : strategy === 'minimum' ? minimum : avalanche;

  return {
    avalanche, snowball, minimum, chosen, strategy,
    totalBalance,
    blendedRate,
    highestRate: live.length ? Math.max(...live.map((l) => l.rate)) : 0,
    lowestRate: live.length ? Math.min(...live.map((l) => l.rate)) : 0,
    totalMinimum,
    extra,
    vsSnowball: snowball.totalInterest - avalanche.totalInterest,
    vsMinimum: minimum.totalInterest - avalanche.totalInterest,
    monthsSavedVsMinimum: minimum.months - avalanche.months,
    counted: live.length,
    ignored,
    underwater,
  };
}
