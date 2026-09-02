/* Client island for the cumulative GPA planner. */
import { mountRoster } from '../lib/roster';
import { computeWith, type Term, type CumulativeModel } from '../lib/tools/cumulative';

const text = (id: string, s: string) => {
  const el = document.getElementById(id);
  if (el) el.textContent = s;
};
const num = (id: string, fallback: number) => {
  const v = Number(String((document.getElementById(id) as HTMLInputElement | null)?.value ?? '')
    .replace(/[^\d.]/g, ''));
  return Number.isFinite(v) ? v : fallback;
};

function verdict(m: CumulativeModel): string {
  if (!m.counted) return 'Add a term with credits and a GPA to begin.';
  const cum = m.cumulative.toFixed(2);
  switch (m.outcome) {
    case 'no-plan':
      return `Your cumulative GPA is ${cum} across ${m.totalCredits} credits. Enter the credits you are about to take and a target to see what the coming term has to average.`;
    case 'already-there':
      return `You are at ${cum}, already above your ${m.target.toFixed(2)} target. Anything at or above ${Math.max(0, m.needed).toFixed(2)} next term holds the line.`;
    case 'impossible':
      return `A ${m.target.toFixed(2)} is out of reach this term: ${m.plannedCredits} credits would have to average ${m.needed.toFixed(2)}, and 4.0 is the ceiling. The best you can reach is ${m.bestPossible.toFixed(2)} — plan around that, or around more terms.`;
    default:
      return `You are at ${cum}. Reaching ${m.target.toFixed(2)} means averaging ${m.needed.toFixed(2)} across the ${m.plannedCredits} credits you take next, which is ${m.needed > m.cumulative ? 'above' : 'below'} your record so far.`;
  }
}

mountRoster<CumulativeModel>({
  id: 'cum',
  param: 't',
  minRows: 1,
  maxRows: 20,
  columns: [
    { key: 'name', label: 'Term', type: 'text', width: 'minmax(0,1fr)', default: '', placeholder: 'Autumn 2025' },
    { key: 'credits', label: 'Credits', type: 'number', width: '96px', default: '', numeric: true, placeholder: '15' },
    { key: 'gpa', label: 'Term GPA', type: 'number', width: '96px', default: '', numeric: true, placeholder: '3.20' },
  ],
  seed: [
    { name: 'First year', credits: '30', gpa: '2.90' },
    { name: 'Second year', credits: '30', gpa: '3.20' },
  ],
  compute: (rows) => computeWith(rows as unknown as Term[], num('cum-target', 3.5), num('cum-planned', 15)),
  onRender(m) {
    text('cum-gpa', m.counted ? m.cumulative.toFixed(2) : '—');
    text('cum-sub', m.counted
      ? `${m.counted} term${m.counted === 1 ? '' : 's'} · ${m.totalCredits} credits`
      : 'Add a term to begin');
    text('cum-need-label', m.outcome === 'impossible' ? 'Out of reach' : 'Next term needs');
    text('cum-need',
      m.outcome === 'no-plan' ? '—'
      : m.outcome === 'impossible' ? 'Above 4.0'
      : m.outcome === 'already-there' ? 'Secured'
      : m.needed.toFixed(2));
    text('cum-best', m.counted && m.plannedCredits > 0 ? m.bestPossible.toFixed(2) : '—');
    text('cum-verdict', verdict(m));
    paintWorking(m);
    paintNotes(m);
  },
});

const nudge = () => document
  .querySelector<HTMLElement>('[data-roster="cum"] [data-k]')
  ?.dispatchEvent(new Event('input', { bubbles: true }));
for (const id of ['cum-target', 'cum-planned']) {
  document.getElementById(id)?.addEventListener('input', nudge);
}

function paintWorking(m: CumulativeModel): void {
  const body = document.getElementById('cum-working');
  if (!body) return;
  body.innerHTML = m.progression.length
    ? m.progression.map((t) => `<div class="working__row">
        <span><strong>${t.name}</strong>
          <span class="working__note">${t.credits} credits at ${t.gpa.toFixed(2)} · ${t.runningCredits} credits cumulative</span></span>
        <span class="working__amt">${t.runningGpa.toFixed(2)}</span></div>`).join('')
    : '<div class="working__row"><span>Nothing counted yet</span><span class="working__amt">—</span></div>';
}

function paintNotes(m: CumulativeModel): void {
  const notes = document.getElementById('cum-notes');
  if (!notes) return;
  const items: string[] = [];
  if (m.counted >= 2) {
    /* Show the reader the error they were about to make, with their own
       numbers. Abstract warnings about weighting do not land; this does. */
    const naive = m.progression.reduce((t, p) => t + p.gpa, 0) / m.progression.length;
    if (Math.abs(naive - m.cumulative) > 0.02) {
      items.push(`<li><strong>Averaging your term GPAs would give ${naive.toFixed(2)}.</strong> The real figure is ${m.cumulative.toFixed(2)}, because terms are weighted by credits. The difference is ${Math.abs(naive - m.cumulative).toFixed(2)}, and it usually runs in the optimistic direction.</li>`);
    }
  }
  if (m.outcome === 'impossible') {
    items.push(`<li><strong>Dropping a course makes this harder, not easier.</strong> Fewer credits next term spreads the same shortfall over less weight, which raises the average you need. If the target matters, more credits at a good grade is the lever.</li>`);
  }
  if (m.totalCredits >= 90 && m.outcome === 'reachable' && Math.abs(m.needed - m.cumulative) < 0.3) {
    items.push(`<li><strong>With ${m.totalCredits} credits behind you the needle barely moves.</strong> A full term now shifts the cumulative by a fraction of what it would have in first year. That is arithmetic, not effort.</li>`);
  }
  if (m.ignored > 0) {
    items.push(`<li><strong>${m.ignored} row${m.ignored === 1 ? ' was' : 's were'} skipped.</strong> A term needs both a credit count above zero and a GPA before it can be weighted.</li>`);
  }
  notes.innerHTML = items.length
    ? `<div class="note note--warn" style="margin-top:var(--s-5)"><strong class="note__title">Worth knowing</strong><ul style="margin:0;padding-left:1.1rem">${items.join('')}</ul></div>`
    : '';
}
