/* Client island for the income-driven repayment comparison. */
import { mountRoster } from '../lib/roster';
import { currency, months as fmtMonths } from '@kit/calc/format';
import { compute, type IdrModel, type IdrInputs } from '../lib/tools/idr';

const text = (id: string, s: string) => {
  const el = document.getElementById(id);
  if (el) el.textContent = s;
};
const num = (id: string, fallback: number) => {
  const v = Number(String((document.getElementById(id) as HTMLInputElement | null)?.value ?? '')
    .replace(/[^\d.]/g, ''));
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

/* The roster holds the loans; everything else is a single value that applies
   to the whole balance, because income-driven plans work on the aggregate. */
function readOptions(): Omit<IdrInputs, 'balance' | 'rate'> {
  const era = document.querySelector<HTMLInputElement>('input[name="idr-era"]:checked')?.value;
  return {
    agi: num('idr-agi', 0),
    householdSize: Math.max(1, Math.round(num('idr-house', 1))),
    dependents: Math.max(0, Math.round(Number(
      String((document.getElementById('idr-dep') as HTMLInputElement | null)?.value ?? '0').replace(/[^\d]/g, '')) || 0)),
    region: ((document.getElementById('idr-region') as HTMLSelectElement | null)?.value
      ?? 'contiguous') as IdrInputs['region'],
    borrowedFromJuly2026: era === 'from',
    preJuly2014: Boolean((document.getElementById('idr-pre2014') as HTMLInputElement | null)?.checked),
  };
}

function fromRows(rows: Array<Record<string, string>>): IdrModel {
  let balance = 0;
  let weighted = 0;
  for (const r of rows) {
    const b = Number(String(r.balance).replace(/[^\d.]/g, ''));
    const rate = Number(String(r.rate).replace(/[^\d.]/g, ''));
    if (!(b > 0) || !Number.isFinite(rate)) continue;
    balance += b;
    weighted += rate * b;
  }
  const rate = balance > 0 ? weighted / balance : 0;
  return compute({ balance, rate, ...readOptions() });
}

function paintTable(m: IdrModel): void {
  const body = document.getElementById('idr-table');
  if (!body) return;
  const rows = m.results.map((r) => {
    if (!r.eligible) {
      return `<div class="working__row" style="opacity:.55">
        <span><strong>${r.plan.short}</strong>
          <span class="working__note">Not available to you — ${r.ineligibleBecause}</span></span>
        <span class="working__amt">—</span></div>`;
    }
    const best = m.best && m.best.plan.id === r.plan.id;
    const low = m.lowestPayment && m.lowestPayment.plan.id === r.plan.id;
    const tags = [
      low ? '<span style="color:var(--c-pop);font-weight:640">lowest payment</span>' : '',
      best && !low ? '<span style="color:var(--c-accent);font-weight:640">lowest total</span>' : '',
      best && low ? '<span style="color:var(--c-accent);font-weight:640">and lowest total</span>' : '',
    ].filter(Boolean).join(' · ');
    const forgiven = r.forgiven
      ? ` · ${currency(r.forgivenAmount)} forgiven after ${r.plan.forgivenessYears} years`
      : ` · clears in ${fmtMonths(r.months)}`;
    return `<div class="working__row">
      <span><strong>${r.plan.short}</strong>${tags ? ' ' + tags : ''}
        <span class="working__note">total ${currency(r.totalPaid)}${forgiven}</span></span>
      <span class="working__amt">${currency(r.monthly)}/mo</span></div>`;
  });
  rows.push(`<div class="working__row">
    <span><strong>10-year standard</strong>
      <span class="working__note">not income-driven — the benchmark every plan above is measured against</span></span>
    <span class="working__amt">${currency(m.standard.monthly)}/mo</span></div>`);
  body.innerHTML = rows.join('');
}

function verdict(m: IdrModel): string {
  if (!m.eligible.length) return 'Add a loan balance and a rate to compare the plans open to you.';
  const low = m.lowestPayment!;
  const best = m.best!;
  if (m.rapOnly) {
    return `Because every loan was disbursed from July 2026, the Repayment Assistance Plan is your only income-driven option — there is no choice to make. It comes to ${currency(low.monthly)} a month against ${currency(m.standard.monthly)} on the ten-year standard plan${low.forgiven ? `, with ${currency(low.forgivenAmount)} forgiven after 30 years` : ', and clears the balance before forgiveness would apply'}.`;
  }
  if (low.plan.id === best.plan.id) {
    return `${low.plan.short} gives you both the lowest payment, ${currency(low.monthly)} a month, and the lowest total at ${currency(low.totalPaid)}${low.forgiven ? ` with ${currency(low.forgivenAmount)} forgiven at the end` : ''}. That is unusual and convenient — normally the cheapest monthly figure costs more overall.`;
  }
  return `${low.plan.short} has the lowest payment at ${currency(low.monthly)} a month, but ${best.plan.short} costs less overall — ${currency(best.totalPaid)} against ${currency(low.totalPaid)}. The gap is ${currency(low.totalPaid - best.totalPaid)}, which is what the smaller monthly payment costs you over the life of the loan.`;
}

function paintNotes(m: IdrModel): void {
  const notes = document.getElementById('idr-notes');
  if (!notes) return;
  const items: string[] = [];
  if (m.rapOnly) {
    items.push(`<li><strong>RAP is your only income-driven plan.</strong> IBR, PAYE and ICR closed to loans first disbursed on or after 1 July 2026. The other rows above are shown so you can see what is not available, not as options.</li>`);
  } else {
    items.push(`<li><strong>SAVE is not on this list because it no longer exists.</strong> A federal court order ended it on 10 March 2026. If you were enrolled, you must pick one of the plans above.</li>`);
  }
  const neg = m.eligible.filter((r) => r.negativelyAmortising && r.plan.id !== 'rap');
  if (neg.length) {
    items.push(`<li><strong>On ${neg.map((r) => r.plan.short).join(' and ')} your payment does not cover the interest.</strong> The balance grows every month you stay on it. That is not necessarily wrong if you are heading for forgiveness — but it is a very different thing from paying a loan down, and worth knowing which one you are doing.</li>`);
  }
  const rap = m.eligible.find((r) => r.plan.id === 'rap');
  if (rap && rap.negativelyAmortising) {
    items.push(`<li><strong>RAP waives the interest your payment does not cover.</strong> On the older plans that unpaid interest would accumulate; here it does not, and the government also matches principal by up to $50 a month. At your income that is the single largest difference between RAP and what came before.</li>`);
  }
  const forgiving = m.eligible.filter((r) => r.forgiven);
  if (forgiving.length) {
    items.push(`<li><strong>A forgiven balance may be taxable.</strong> ${forgiving.map((r) => `${r.plan.short} would write off ${currency(r.forgivenAmount)}`).join('; ')}. Discharged amounts have historically counted as income in the year of forgiveness, and the federal exclusion has lapsed and been renewed more than once. Check the position for the year you expect it.</li>`);
  }
  if (m.agi > 0 && m.discretionary === 0) {
    items.push(`<li><strong>Your income is at or below 150% of the poverty guideline.</strong> On the older plans that means a calculated payment of zero, which still counts as a qualifying payment toward forgiveness. RAP has no such protection — it charges a share of total income with a $10 floor.</li>`);
  }
  notes.innerHTML = items.length
    ? `<div class="note note--warn" style="margin-top:var(--s-5)"><strong class="note__title">Worth knowing</strong><ul style="margin:0;padding-left:1.1rem">${items.join('')}</ul></div>`
    : '';
}

mountRoster<IdrModel>({
  id: 'idr',
  param: 'r',
  minRows: 1,
  maxRows: 12,
  columns: [
    { key: 'name', label: 'Loan', type: 'text', width: 'minmax(0,1fr)', default: '', placeholder: 'Servicer or year' },
    { key: 'balance', label: 'Balance', type: 'number', width: '118px', default: '', numeric: true, placeholder: '20000' },
    { key: 'rate', label: 'Rate %', type: 'number', width: '90px', default: '', numeric: true, placeholder: '6.53' },
  ],
  seed: [
    { name: 'Unsubsidised 2023', balance: '22000', rate: '5.50' },
    { name: 'Unsubsidised 2024', balance: '20000', rate: '6.53' },
  ],
  compute: fromRows,
  onRender(m) {
    const low = m.lowestPayment;
    text('idr-label', m.rapOnly ? 'Repayment Assistance Plan' : 'Lowest monthly payment');
    text('idr-low', low ? currency(low.monthly) : '—');
    text('idr-sub', low
      ? `${low.plan.short} · ${m.eligible.length} plan${m.eligible.length === 1 ? '' : 's'} open to you`
      : 'Add a loan balance and rate');
    text('idr-std', currency(m.standard.monthly));
    text('idr-disc', currency(m.discretionary));
    text('idr-verdict', verdict(m));
    paintTable(m);
    paintNotes(m);
  },
});

/* Everything outside the roster has to poke it. Nudging a cell the roster
   already listens to keeps one recompute path rather than a second entry. */
const nudge = () => document
  .querySelector<HTMLElement>('[data-roster="idr"] [data-k]')
  ?.dispatchEvent(new Event('input', { bubbles: true }));
for (const id of ['idr-agi', 'idr-house', 'idr-dep']) {
  document.getElementById(id)?.addEventListener('input', nudge);
}
document.getElementById('idr-region')?.addEventListener('change', nudge);
document.getElementById('idr-pre2014')?.addEventListener('change', nudge);
for (const r of document.querySelectorAll('input[name="idr-era"]')) r.addEventListener('change', nudge);
