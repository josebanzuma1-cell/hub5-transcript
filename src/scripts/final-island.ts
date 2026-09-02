/* Client island for the final-grade calculator. */
import { mountRoster } from '../lib/roster';
import { computeWith, type Component, type FinalGradeModel } from '../lib/tools/final-grade';

const text = (id: string, s: string) => {
  const el = document.getElementById(id);
  if (el) el.textContent = s;
};
const targetInput = () => document.getElementById('fin-target') as HTMLInputElement | null;
const readTarget = () => {
  const v = Number(String(targetInput()?.value ?? '90').replace(/[^\d.]/g, ''));
  return Number.isFinite(v) ? v : 90;
};

function verdict(m: FinalGradeModel): string {
  const t = m.target.toFixed(0);
  switch (m.outcome) {
    case 'no-final':
      return `Every component is graded, so there is nothing left to solve for — the course grade is ${m.currentGrade.toFixed(1)}%.`;
    case 'impossible':
      return `A ${t}% is out of reach: even a perfect final leaves you at ${m.bestPossible.toFixed(1)}%. That is worth knowing now rather than after the exam — if this grade matters, ask about extra credit or a reweighting while the course is still running.`;
    case 'secured':
      return `You already have it. Even scoring zero on the final leaves you at ${m.worstPossible.toFixed(1)}%, above your ${t}% target. Sit the exam, but you can stop revising in a panic.`;
    default:
      return `You need ${m.needed.toFixed(1)}% on the final to finish at ${t}%. The final is worth ${m.remainingWeight.toFixed(0)}% of the course, and you have banked ${m.earnedSoFar.toFixed(1)} of the 100 points available.`;
  }
}

mountRoster<FinalGradeModel>({
  id: 'fin',
  param: 'g',
  minRows: 1,
  maxRows: 20,
  columns: [
    { key: 'name', label: 'Component', type: 'text', width: 'minmax(0,1fr)', default: '', placeholder: 'Homework, midterm…' },
    { key: 'weight', label: 'Weight %', type: 'number', width: '96px', default: '', numeric: true, placeholder: '20' },
    { key: 'score', label: 'Your score %', type: 'number', width: '96px', default: '', numeric: true, placeholder: '—' },
  ],
  seed: [
    { name: 'Homework', weight: '20', score: '92' },
    { name: 'Quizzes', weight: '15', score: '85' },
    { name: 'Midterm', weight: '25', score: '78' },
    { name: 'Final exam', weight: '40', score: '' },
  ],
  compute: (rows) => computeWith(rows as unknown as Component[], readTarget()),
  onRender(m) {
    const secured = m.outcome === 'secured';
    const impossible = m.outcome === 'impossible';
    text('fin-label', impossible ? 'Target out of reach' : secured ? 'Already secured' : 'Needed on the final');
    text('fin-need',
      m.outcome === 'no-final' ? m.currentGrade.toFixed(1) + '%'
      : impossible ? 'Not possible'
      : secured ? 'Any mark'
      : m.needed.toFixed(1) + '%');
    text('fin-sub', m.counted
      ? `${m.gradedWeight.toFixed(0)}% of the course graded, ${m.remainingWeight.toFixed(0)}% still to come`
      : 'Add a component with a weight and a score');
    text('fin-cur', m.counted ? m.currentGrade.toFixed(1) + '%' : '—');
    text('fin-best', m.counted ? m.bestPossible.toFixed(1) + '%' : '—');
    text('fin-verdict', verdict(m));
    paintWorking(m);
    paintNotes(m);
  },
});

// The target lives outside the roster, so it needs its own nudge.
targetInput()?.addEventListener('input', () => {
  document.querySelector<HTMLElement>('[data-roster="fin"] [data-k]')
    ?.dispatchEvent(new Event('input', { bubbles: true }));
});

function paintWorking(m: FinalGradeModel): void {
  const body = document.getElementById('fin-working');
  if (!body) return;
  body.innerHTML = m.breakdown.map((b) => `<div class="working__row">
      <span><strong>${b.name}</strong>
        <span class="working__note">worth ${b.weight}% of the course · scored ${b.score}%</span></span>
      <span class="working__amt">${b.contributes.toFixed(1)} pts</span></div>`).join('')
    + `<div class="working__row"><span><strong>Banked so far</strong>
         <span class="working__note">out of 100 points for the whole course</span></span>
       <span class="working__amt">${m.earnedSoFar.toFixed(1)}</span></div>`
    + `<div class="working__row"><span><strong>Still to be decided</strong>
         <span class="working__note">weight with no score entered</span></span>
       <span class="working__amt">${m.remainingWeight.toFixed(0)}%</span></div>`;
}

function paintNotes(m: FinalGradeModel): void {
  const notes = document.getElementById('fin-notes');
  if (!notes) return;
  const items: string[] = [];
  const totalWeight = m.gradedWeight + m.remainingWeight;
  if (m.gradedWeight > 100.01) {
    items.push(`<li><strong>Your graded weights add up to ${m.gradedWeight.toFixed(0)}%.</strong> That is more than the whole course, so something has been entered twice. The answer above is wrong until it is fixed.</li>`);
  } else if (m.counted && m.remainingWeight === 0 && totalWeight < 99.99) {
    items.push(`<li><strong>Your weights only add up to ${totalWeight.toFixed(0)}%.</strong> Anything missing is being treated as already decided. Add the remaining components with a blank score so the final's weight is right.</li>`);
  }
  if (m.outcome === 'impossible') {
    items.push(`<li><strong>The best you can still finish with is ${m.bestPossible.toFixed(1)}%.</strong> That assumes a perfect final. If a specific grade is a condition of something, this is the moment to raise it — not after results.</li>`);
  }
  if (m.remainingWeight >= 50) {
    items.push(`<li><strong>This final is worth ${m.remainingWeight.toFixed(0)}% of the course.</strong> That is enough to move you two letter grades in either direction, so the figure above is worth taking seriously.</li>`);
  }
  if (m.remainingWeight > 0 && m.remainingWeight <= 20 && m.outcome === 'reachable') {
    items.push(`<li><strong>The final is only worth ${m.remainingWeight.toFixed(0)}%.</strong> The marks you have banked are doing most of the work — a good exam versus a poor one is about ${(m.remainingWeight * 0.3).toFixed(1)} points of your course grade.</li>`);
  }
  notes.innerHTML = items.length
    ? `<div class="note note--warn" style="margin-top:var(--s-5)"><strong class="note__title">Worth knowing</strong><ul style="margin:0;padding-left:1.1rem">${items.join('')}</ul></div>`
    : '';
}
