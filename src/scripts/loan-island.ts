/* Client island for the student loan payoff calculator. */
import { mountRoster } from '../lib/roster';
import { lineChart } from '@kit/calc/chart';
import { currency, currencyCompact, months as fmtMonths } from '@kit/calc/format';
import { computeWith, type Loan, type LoanModel, type Strategy } from '../lib/tools/loan-payoff';

const text = (id: string, s: string) => {
  const el = document.getElementById(id);
  if (el) el.textContent = s;
};
const readExtra = () => {
  const v = Number(String((document.getElementById('loan-extra') as HTMLInputElement | null)?.value ?? '0')
    .replace(/[^\d.]/g, ''));
  return Number.isFinite(v) ? v : 0;
};
const readStrategy = (): Strategy =>
  (document.querySelector<HTMLInputElement>('input[name="loan-strategy"]:checked')?.value as Strategy) ?? 'avalanche';

const STRATEGY_LABEL: Record<Strategy, string> = {
  avalanche: 'highest rate first',
  snowball: 'smallest balance first',
  minimum: 'minimums only',
};

function verdict(m: LoanModel): string {
  if (!m.counted) return 'Add a loan with a balance, a rate and a minimum payment to begin.';
  if (m.chosen.neverPaysOff) {
    return 'On these payments the balance never clears — the minimums do not cover the interest. Raising the payment above the interest line is the only thing that matters here.';
  }
  const when = fmtMonths(m.chosen.months);
  if (m.strategy === 'minimum') {
    return `Paying only the minimums clears everything in ${when} and costs ${currency(m.minimum.totalInterest)} in interest. Adding ${currency(m.extra)} a month would save ${currency(m.vsMinimum)} and finish ${fmtMonths(m.monthsSavedVsMinimum)} sooner.`;
  }
  const gap = m.vsSnowball;
  const tail = m.strategy === 'avalanche'
    ? (gap > 1
        ? ` Going smallest-balance-first instead would cost ${currency(gap)} more — worth it only if the early wins keep you going.`
        : ' Smallest-balance-first costs about the same here, so take whichever you will actually stick to.')
    : (gap > 1
        ? ` Highest-rate-first would save ${currency(gap)} of that. You are paying for the earlier wins, which is a real trade and not a mistake.`
        : ' Highest-rate-first would cost about the same here, so there is nothing to give up.');
  return `Paying ${STRATEGY_LABEL[m.strategy]} with ${currency(m.extra)} extra a month clears everything in ${when} and costs ${currency(m.chosen.totalInterest)} in interest.${tail}`;
}

function paintCompare(m: LoanModel): void {
  const body = document.getElementById('loan-compare');
  if (!body) return;
  const row = (name: string, r: LoanModel['avalanche'], best: boolean) => `
    <div class="working__row">
      <span><strong>${name}</strong>${best ? ' <span style="color:var(--c-pop);font-weight:640">cheapest</span>' : ''}
        <span class="working__note">${r.neverPaysOff ? 'never clears on these payments' : `clears in ${fmtMonths(r.months)}`}</span>
      </span>
      <span class="working__amt">${r.neverPaysOff ? '—' : currency(r.totalInterest)}</span>
    </div>`;
  const cheapest = Math.min(m.avalanche.totalInterest, m.snowball.totalInterest, m.minimum.totalInterest);
  body.innerHTML =
    row('Highest rate first', m.avalanche, m.avalanche.totalInterest === cheapest)
    + row('Smallest balance first', m.snowball, m.snowball.totalInterest === cheapest)
    + row('Minimums only', m.minimum, m.minimum.totalInterest === cheapest)
    + (m.chosen.order.length
      ? `<div class="working__row"><span><strong>Payoff order</strong>
           <span class="working__note">${m.chosen.order.map((o) => `${o.name} — month ${o.month}`).join(' · ')}</span></span>
         <span class="working__amt"></span></div>`
      : '');
}

function paintChart(m: LoanModel): void {
  const el = document.getElementById('chart-loan');
  if (!el || !m.counted) return;
  const cap = Math.max(m.chosen.balances.length, m.minimum.balances.length);
  const pad = (a: number[]) => a.concat(Array(Math.max(0, cap - a.length)).fill(0));
  lineChart(el, {
    series: [
      { name: 'Minimums only', color: 'var(--c-series-3)', points: pad(m.minimum.balances), dashed: true },
      { name: `Your plan (${STRATEGY_LABEL[m.strategy]})`, color: 'var(--c-series-1)', points: pad(m.chosen.balances), fill: true },
    ],
    xTicks: [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      at: Math.round(f * (cap - 1)),
      label: `${Math.round((f * (cap - 1)) / 12)}y`,
    })),
    yFormat: currencyCompact,
    xFormat: (i) => `month ${i}`,
    height: 240,
    legend: true,
    crosshair: true,
    zeroBaseline: true,
  });
}

function paintNotes(m: LoanModel): void {
  const notes = document.getElementById('loan-notes');
  if (!notes) return;
  const items: string[] = [];
  if (m.underwater.length) {
    items.push(`<li><strong>The minimum on ${m.underwater.join(' and ')} does not cover the interest.</strong> That balance grows every month no matter how long you pay. Getting the payment above the interest line matters more than any strategy on this page.</li>`);
  }
  if (m.counted > 1 && m.highestRate - m.lowestRate >= 2) {
    items.push(`<li><strong>Your rates run from ${m.lowestRate}% to ${m.highestRate}%.</strong> That spread is exactly why the loans are listed separately — a blended ${m.blendedRate.toFixed(2)}% would have hidden the decision about where the extra goes.</li>`);
  }
  if (m.extra === 0 && m.counted) {
    items.push(`<li><strong>Nothing extra is being paid.</strong> Try ${currency(50)} or ${currency(100)} a month — because every extra dollar goes straight against principal, the effect is larger than it looks.</li>`);
  }
  if (m.ignored > 0) {
    items.push(`<li><strong>${m.ignored} row${m.ignored === 1 ? ' was' : 's were'} skipped.</strong> A loan needs a balance above zero, a rate, and a minimum payment above zero before it can be modelled.</li>`);
  }
  if (m.counted && !m.chosen.neverPaysOff && m.chosen.order.length > 1) {
    const first = m.chosen.order[0];
    const last = m.chosen.order[m.chosen.order.length - 1];
    const gap1 = first.month;
    const gapLast = last.month - m.chosen.order[m.chosen.order.length - 2].month;
    if (gapLast < gap1) {
      items.push(`<li><strong>The last loan falls much faster than the first.</strong> ${first.name} took ${gap1} months; the final one took ${gapLast} after the one before it. Each cleared loan frees its minimum to attack the next — which is why paying extra early is worth far more than paying extra later.</li>`);
    }
  }
  notes.innerHTML = items.length
    ? `<div class="note note--warn" style="margin-top:var(--s-5)"><strong class="note__title">Worth knowing</strong><ul style="margin:0;padding-left:1.1rem">${items.join('')}</ul></div>`
    : '';
}

mountRoster<LoanModel>({
  id: 'loan',
  param: 'l',
  minRows: 1,
  maxRows: 15,
  columns: [
    { key: 'name', label: 'Loan', type: 'text', width: 'minmax(0,1fr)', default: '', placeholder: 'Servicer or year' },
    { key: 'balance', label: 'Balance', type: 'number', width: '110px', default: '', numeric: true, placeholder: '10000' },
    { key: 'rate', label: 'Rate %', type: 'number', width: '84px', default: '', numeric: true, placeholder: '5.5' },
    { key: 'minimum', label: 'Minimum', type: 'number', width: '96px', default: '', numeric: true, placeholder: '120' },
  ],
  seed: [
    { name: 'Subsidised 2022', balance: '9500', rate: '4.99', minimum: '105' },
    { name: 'Unsubsidised 2023', balance: '11000', rate: '5.50', minimum: '120' },
    { name: 'Unsubsidised 2024', balance: '9000', rate: '6.53', minimum: '100' },
    { name: 'Private', balance: '6500', rate: '9.25', minimum: '85' },
  ],
  compute: (rows) => computeWith(rows as unknown as Loan[], readExtra(), readStrategy()),
  onRender(m) {
    text('loan-when', m.counted
      ? (m.chosen.neverPaysOff ? 'Never' : fmtMonths(m.chosen.months))
      : '—');
    text('loan-sub', m.counted
      ? `${m.counted} loan${m.counted === 1 ? '' : 's'} · minimums ${currency(m.totalMinimum)}/mo · blended ${m.blendedRate.toFixed(2)}%`
      : 'Add a loan to begin');
    text('loan-int', m.counted && !m.chosen.neverPaysOff ? currency(m.chosen.totalInterest) : '—');
    text('loan-bal', m.counted ? currency(m.totalBalance) : '—');
    text('loan-verdict', verdict(m));
    paintCompare(m);
    paintChart(m);
    paintNotes(m);
  },
});

/* The extra payment and the strategy live outside the roster, so they have to
   poke it. Nudging a cell it already listens to keeps one code path for
   recompute rather than exposing a second entry point. */
const nudge = () => document
  .querySelector<HTMLElement>('[data-roster="loan"] [data-k]')
  ?.dispatchEvent(new Event('input', { bubbles: true }));
document.getElementById('loan-extra')?.addEventListener('input', nudge);
for (const r of document.querySelectorAll('input[name="loan-strategy"]')) {
  r.addEventListener('change', nudge);
}
