/* Client island for the true-cost-of-college calculator. Shared by the
   generic page and all 142 institution pages. */
import { currency } from '@kit/calc/format';
import { compute, netPriceFor, INCOME_BANDS, type IncomeBand, type CostModel } from '../lib/tools/college-cost';
import { COLLEGES, type College } from '@data/colleges';

const text = (id: string, s: string) => {
  const el = document.getElementById(id);
  if (el) el.textContent = s;
};
const num = (id: string, fallback: number) => {
  const v = Number(String((document.getElementById(id) as HTMLInputElement | null)?.value ?? '')
    .replace(/[^0-9.]/g, ''));
  return Number.isFinite(v) ? v : fallback;
};
const sel = (id: string) => (document.getElementById(id) as HTMLSelectElement | null)?.value ?? '';

/* Each /colleges/[slug] page renders its own institution selected. The
   dropdown is built client-side from the imported list, so it has to be told
   which one to open on — otherwise all 142 pages would show the first. */
const raw = document.getElementById('cost-default-school')?.textContent;
let pageSlug = '';
try { pageSlug = raw ? JSON.parse(raw) : ''; } catch { pageSlug = ''; }

const sorted = [...COLLEGES].sort((a, b) => a.name.localeCompare(b.name));
const dropdown = document.getElementById('cost-school') as HTMLSelectElement | null;
if (dropdown) {
  dropdown.innerHTML = sorted
    .map((c) => `<option value="${c.slug}"${c.slug === pageSlug ? ' selected' : ''}>${c.name} — ${c.state}</option>`)
    .join('');
  if (!pageSlug && sorted.length) dropdown.value = sorted[0].slug;
}

const current = (): College =>
  COLLEGES.find((c) => c.slug === (dropdown?.value || pageSlug)) ?? sorted[0];

function verdict(m: CostModel, c: College, band: IncomeBand): string {
  const label = INCOME_BANDS.find((b) => b.id === band)?.label ?? '';
  const price = netPriceFor(c, band);
  const stickerBit = c.sticker && c.sticker > price
    ? ` The published sticker price is ${currency(c.sticker)} a year — ${currency(c.sticker - price)} more than families in your band actually pay.`
    : '';
  if (m.debtAtGraduation <= 0) {
    return `At ${c.name}, a family earning ${label.toLowerCase()} pays about ${currency(price)} a year, and on these numbers you finish with no debt at all.${stickerBit}`;
  }
  const earn = m.earnings10
    ? ` Median earnings ten years after entry are ${currency(m.earnings10)}, so the payment would take ${m.paymentShareOfIncome!.toFixed(0)}% of that income.`
    : '';
  return `At ${c.name}, a family earning ${label.toLowerCase()} pays about ${currency(price)} a year. Over ${m.yearly.length} years that is ${currency(m.totalCost)}, leaving ${currency(m.debtAtGraduation)} of debt and ${currency(m.monthlyPayment)} a month for ten years.${earn}${stickerBit}`;
}

function paintBands(c: College, band: IncomeBand): void {
  const body = document.getElementById('cost-bands');
  if (!body) return;
  const rows = INCOME_BANDS.map((b) => {
    const v = c.byIncome[b.id];
    const here = b.id === band;
    return `<div class="working__row"${here ? ' style="background:var(--c-accent-soft);margin-inline:calc(var(--s-5)*-1);padding-inline:var(--s-5)"' : ''}>
      <span><strong>${b.label}</strong>${here ? ' <span style="color:var(--c-accent);font-weight:640">yours</span>' : ''}
        <span class="working__note">${v == null ? 'not published for this institution' : 'average net price per year, after grant aid'}</span></span>
      <span class="working__amt">${v == null ? '—' : currency(v)}</span></div>`;
  });
  if (c.sticker) {
    rows.push(`<div class="working__row">
      <span><strong>Published sticker price</strong>
        <span class="working__note">cost of attendance before any aid — almost nobody pays this</span></span>
      <span class="working__amt">${currency(c.sticker)}</span></div>`);
  }
  body.innerHTML = rows.join('');
}

function paintNotes(m: CostModel, c: College, band: IncomeBand): void {
  const notes = document.getElementById('cost-notes');
  if (!notes) return;
  const items: string[] = [];
  const lo = c.byIncome.low;
  const hi = c.byIncome.high;
  if (lo != null && hi != null && hi - lo > 5000) {
    items.push(`<li><strong>The same degree costs ${currency(hi - lo)} a year more for a high-income family than a low-income one here.</strong> That is not a discount scheme you have to find — it is the published net price, and it is why comparing sticker prices between institutions tells you almost nothing.</li>`);
  }
  if (m.debtExceedsEarnings) {
    items.push(`<li><strong>Debt at graduation would exceed first-year median earnings.</strong> ${currency(m.debtAtGraduation)} against ${currency(m.earnings10!)}. The rule of thumb most advisers use is to keep total borrowing below expected first-year salary; above it, repayment stops being comfortable.</li>`);
  }
  if (m.paymentShareOfIncome != null && m.paymentShareOfIncome > 15) {
    items.push(`<li><strong>The payment would take ${m.paymentShareOfIncome.toFixed(0)}% of median earnings.</strong> Above roughly 10% most borrowers find repayment genuinely constraining — it is the point at which an income-driven plan starts to make sense rather than being a fallback.</li>`);
  }
  if (c.completion != null && c.completion < 0.5) {
    items.push(`<li><strong>Fewer than half of students here finish within six years</strong> (${(c.completion * 100).toFixed(0)}%). The cost above assumes you graduate on time. Not finishing is the worst financial outcome available — the debt survives, the degree does not.</li>`);
  }
  if (c.ownership === 'for-profit') {
    items.push(`<li><strong>This is a for-profit institution.</strong> Worth checking completion rates and earnings against a public university in the same state before committing, because the gap is often large.</li>`);
  }
  notes.innerHTML = items.length
    ? `<div class="note note--warn" style="margin-top:var(--s-5)"><strong class="note__title">Worth knowing</strong><ul style="margin:0;padding-left:1.1rem">${items.join('')}</ul></div>`
    : '';
}

/* Deliberately NOT mounted through the roster manager. Its rows are derived
   from the inputs rather than typed into, so there is nothing to add, remove
   or bind — and an earlier version that did use it broke as soon as the
   derived rows replaced the cells the manager was listening to. The table
   still earns its place: it makes the inflation visible, because year four
   costing more than year one is invisible in a single total. */
function paintYears(m: CostModel): void {
  const body = document.querySelector('[data-roster="cost"] [data-roster-body]');
  if (!body) return;
  const schol = num('cost-schol', 0);
  const contrib = num('cost-contrib', 0);
  body.innerHTML = m.yearly.map((cost, i) => {
    const borrow = Math.max(0, cost - schol - contrib);
    return `<div class="roster__row" style="grid-template-columns:var(--roster-cols)">
      <div class="roster__cell"><strong>Year ${i + 1}</strong></div>
      <div class="roster__cell roster__input--num">${currency(cost)}</div>
      <div class="roster__cell roster__input--num">${borrow > 0 ? currency(borrow) : 'nothing'}</div>
    </div>`;
  }).join('');
}

function render(): void {
  const c = current();
  if (!c) return;
  const band = (sel('cost-income') || 'mid') as IncomeBand;
  const m = compute({
    netPricePerYear: netPriceFor(c, band),
    years: num('cost-years', 4),
    scholarships: num('cost-schol', 0),
    contribution: num('cost-contrib', 0),
    inflation: 3,
    loanRate: num('cost-rate', 6.53),
    loanYears: 10,
    earnings10: c.earnings10,
  });

  text('cost-total', currency(m.totalCost));
  text('cost-sub', `${c.name} · ${m.yearly.length} years · 3% annual cost rise`);
  text('cost-debt', currency(m.debtAtGraduation));
  text('cost-mo', m.monthlyPayment > 0 ? currency(m.monthlyPayment) : '—');
  text('cost-verdict', verdict(m, c, band));
  paintYears(m);
  paintBands(c, band);
  paintNotes(m, c, band);

  const url = new URL(location.href);
  if (dropdown && dropdown.value && !pageSlug) url.searchParams.set('s', dropdown.value);
  url.searchParams.set('i', band);
  history.replaceState(history.state, '', url.pathname + url.search);
}

// The roster chrome belongs to editable tables; this one has nothing to edit.
for (const s of ['[data-roster-add]', '[data-roster-reset]']) {
  document.querySelector<HTMLElement>(`[data-roster="cost"] ${s}`)?.remove();
}
const head = document.querySelector<HTMLElement>('[data-roster="cost"] .roster__head');
if (head) head.style.gridTemplateColumns = 'var(--roster-cols)';

for (const id of ['cost-schol', 'cost-contrib', 'cost-years', 'cost-rate']) {
  document.getElementById(id)?.addEventListener('input', render);
}
for (const id of ['cost-school', 'cost-income']) {
  document.getElementById(id)?.addEventListener('change', render);
}

/* A shared link carries the institution and the income band. */
const q = new URLSearchParams(location.search);
const qs = q.get('s');
const qi = q.get('i');
if (qs && dropdown && sorted.some((c) => c.slug === qs)) dropdown.value = qs;
if (qi) {
  const inc = document.getElementById('cost-income') as HTMLSelectElement | null;
  if (inc && INCOME_BANDS.some((b) => b.id === qi)) inc.value = qi;
}

render();
document.querySelector<HTMLElement>('[data-roster="cost"]')?.setAttribute('data-state', 'ready');