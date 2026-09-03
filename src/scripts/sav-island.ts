/* Client island for the 529 savings planner.

   Like the college cost tool, this is not mounted through the roster manager:
   its rows are the projection year by year, derived rather than typed. The
   table earns its place by splitting contributions from growth, which is the
   one thing a single projected balance cannot show. */
import { lineChart } from '@kit/calc/chart';
import { currency, currencyCompact } from '@kit/calc/format';
import { compute, type SavingsModel } from '../lib/tools/savings-529';

const text = (id: string, s: string) => {
  const el = document.getElementById(id);
  if (el) el.textContent = s;
};
const num = (id: string, fallback: number) => {
  const v = Number(String((document.getElementById(id) as HTMLInputElement | null)?.value ?? '')
    .replace(/[^0-9.]/g, ''));
  return Number.isFinite(v) ? v : fallback;
};

function verdict(m: SavingsModel, monthly: number, years: number): string {
  if (m.covered) {
    return `On track. By the first year you would have ${currency(m.projectedBalance)} against a target of ${currency(m.target)} — a surplus of ${currency(m.surplus)}. Worth checking you are not over-saving: earnings withdrawn for anything other than education attract tax and a 10% penalty.`;
  }
  const wait = m.costOfWaitingAYear > 0
    ? ` Waiting a year before starting would push that to ${currency(m.requiredMonthly + m.costOfWaitingAYear)}.`
    : '';
  return `${currency(monthly)} a month grows to ${currency(m.projectedBalance)} over ${years} years, which leaves you ${currency(m.shortfall)} short of the ${currency(m.target)} you are aiming at. Closing it needs about ${currency(m.requiredMonthly)} a month from today.${wait}`;
}

function render(): void {
  const monthly = num('sav-mo', 0);
  const years = Math.max(0, Math.round(num('sav-years', 15)));
  const m = compute({
    currentBalance: num('sav-bal', 0),
    monthlyContribution: monthly,
    lumpSum: num('sav-lump', 0),
    yearsUntilStart: years,
    annualReturn: num('sav-return', 6),
    annualCost: num('sav-cost', 25000),
    yearsOfStudy: Math.max(1, Math.round(num('sav-study', 4))),
    costInflation: 4,
    targetShare: num('sav-share', 50),
  });

  text('sav-label', m.covered ? 'Projected — target met' : 'Projected by the first year');
  text('sav-total', currency(m.projectedBalance));
  text('sav-sub', `${currency(m.totalContributed)} contributed, ${currency(m.growth)} from growth`);
  text('sav-target', currency(m.target));
  text('sav-gap-label', m.covered ? 'Surplus' : 'Shortfall');
  text('sav-gap', currency(m.covered ? m.surplus : m.shortfall));
  text('sav-verdict', verdict(m, monthly, years));

  /* Year-by-year, splitting what you put in from what the growth added. */
  const body = document.querySelector('[data-roster="sav"] [data-roster-body]');
  if (body) {
    const start = num('sav-bal', 0) + num('sav-lump', 0);
    body.innerHTML = m.balances.map((bal, i) => {
      const contributed = start + monthly * 12 * i;
      const growth = Math.max(0, bal - contributed);
      return `<div class="roster__row" style="grid-template-columns:var(--roster-cols)">
        <div class="roster__cell"><strong>${i === 0 ? 'Today' : `Year ${i}`}</strong></div>
        <div class="roster__cell roster__input--num">${currency(bal)}</div>
        <div class="roster__cell roster__input--num">${growth > 0 ? currency(growth) : '—'}</div>
      </div>`;
    }).join('');
  }

  const el = document.getElementById('chart-sav');
  if (el && m.balances.length > 1) {
    const start = num('sav-bal', 0) + num('sav-lump', 0);
    lineChart(el, {
      series: [
        { name: 'What you put in', color: 'var(--c-series-3)', points: m.balances.map((_, i) => start + monthly * 12 * i), dashed: true },
        { name: 'Balance', color: 'var(--c-series-1)', points: m.balances, fill: true },
      ],
      xTicks: [0, 0.5, 1].map((f) => ({
        at: Math.round(f * (m.balances.length - 1)),
        label: `${Math.round(f * (m.balances.length - 1))}y`,
      })),
      yFormat: currencyCompact,
      xFormat: (i) => (i === 0 ? 'today' : `year ${i}`),
      height: 240, legend: true, crosshair: true, zeroBaseline: true,
    });
  }

  paintNotes(m, monthly, years);

  const url = new URL(location.href);
  url.searchParams.set('m', String(monthly));
  url.searchParams.set('y', String(years));
  history.replaceState(history.state, '', url.pathname + url.search);
}

function paintNotes(m: SavingsModel, monthly: number, years: number): void {
  const notes = document.getElementById('sav-notes');
  if (!notes) return;
  const items: string[] = [];

  if (m.costOfWaitingAYear > 0 && !m.covered) {
    items.push(`<li><strong>Waiting one year adds ${currency(m.costOfWaitingAYear)} a month</strong> to what you would need from then on. The early money is the money that compounds longest, which is why delay costs more than the contributions you skipped.</li>`);
  }
  if (m.growth > m.totalContributed * 0.4) {
    items.push(`<li><strong>Growth is doing ${((m.growth / m.projectedBalance) * 100).toFixed(0)}% of the work here.</strong> ${currency(m.growth)} of the projected balance comes from returns rather than contributions, and none of it is taxed on the way out if it is spent on qualified expenses.</li>`);
  }
  if (years <= 5) {
    items.push(`<li><strong>With ${years} year${years === 1 ? '' : 's'} to go, compounding contributes little.</strong> What you put in is roughly what you get out, so the return assumption barely matters — and the case for taking investment risk with money needed on a fixed date is weak. Saving here is about reducing borrowing rather than replacing it, which is still worth doing.</li>`);
  }
  if (m.overExclusion) {
    items.push(`<li><strong>${currency(monthly * 12)} a year is above the ${currency(m.annualExclusion)} gift tax annual exclusion.</strong> That means filing a gift tax return rather than paying tax, for most families. The five-year election lets a single donor front-load ${currency(m.fiveYearElection)} at once instead.</li>`);
  }
  if (m.covered && m.surplus > m.target * 0.2) {
    items.push(`<li><strong>You are on track to overshoot by ${currency(m.surplus)}.</strong> Earnings withdrawn for anything other than qualified education expenses attract income tax plus a 10% penalty on the growth, so over-saving has a real cost. Consider aiming at a smaller share, or spreading the surplus elsewhere.</li>`);
  }
  if (num('sav-share', 50) >= 100) {
    items.push(`<li><strong>You are aiming to cover the whole cost from savings.</strong> Almost nobody does. A third from savings, a third from income during the degree and a third from borrowing is the common planning split, and a family that saves a third has removed a third of the debt.</li>`);
  }
  notes.innerHTML = items.length
    ? `<div class="note note--warn" style="margin-top:var(--s-5)"><strong class="note__title">Worth knowing</strong><ul style="margin:0;padding-left:1.1rem">${items.join('')}</ul></div>`
    : '';
}

// The roster chrome belongs to editable tables; this projection has nothing to edit.
for (const s of ['[data-roster-add]', '[data-roster-reset]']) {
  document.querySelector<HTMLElement>(`[data-roster="sav"] ${s}`)?.remove();
}
const head = document.querySelector<HTMLElement>('[data-roster="sav"] .roster__head');
if (head) head.style.gridTemplateColumns = 'var(--roster-cols)';

for (const id of ['sav-bal', 'sav-mo', 'sav-lump', 'sav-years', 'sav-cost', 'sav-study', 'sav-share', 'sav-return']) {
  document.getElementById(id)?.addEventListener('input', render);
}

// A shared link carries the two figures people actually change.
const q = new URLSearchParams(location.search);
for (const [param, id] of [['m', 'sav-mo'], ['y', 'sav-years']] as const) {
  const v = q.get(param);
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (v && el && Number.isFinite(Number(v))) el.value = v;
}

render();
document.querySelector<HTMLElement>('[data-roster="sav"]')?.setAttribute('data-state', 'ready');
