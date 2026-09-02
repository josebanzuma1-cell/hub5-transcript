/* Client island for the GPA calculator. */
import { mountRoster } from '../lib/roster';
import { compute, GRADES, LEVELS, type Course, type GpaModel } from '../lib/tools/gpa';

const text = (id: string, s: string) => {
  const el = document.getElementById(id);
  if (el) el.textContent = s;
};

function verdict(m: GpaModel): string {
  if (!m.counted) {
    return 'Nothing to average yet — a row needs both a credit value and a grade before it counts.';
  }
  if (m.noWeighting) {
    return `Your GPA is ${m.unweighted.toFixed(2)} across ${m.totalCredits} credits. Every course here is marked regular, so the weighted and unweighted figures are the same — set a course to Honours or AP if that is not right.`;
  }
  return `Unweighted you are at ${m.unweighted.toFixed(2)}; weighted, ${m.weighted.toFixed(2)}. The harder courses are worth ${m.weightBonus.toFixed(2)} of GPA, and which figure you quote depends on who is asking — most applications recalculate the unweighted one.`;
}

mountRoster<GpaModel>({
  id: 'gpa',
  param: 'c',
  minRows: 1,
  maxRows: 30,
  columns: [
    { key: 'name', label: 'Course', type: 'text', width: 'minmax(0,1fr)', default: '', placeholder: 'Course name' },
    { key: 'credits', label: 'Credits', type: 'number', width: '82px', default: '1', numeric: true },
    { key: 'grade', label: 'Grade', type: 'select', width: '92px', default: 'A',
      options: GRADES.map((g) => ({ value: g.id, label: g.id })) },
    { key: 'level', label: 'Level', type: 'select', width: '132px', default: 'reg',
      options: LEVELS.map((l) => ({ value: l.id, label: l.label })) },
  ],
  seed: [
    { name: 'AP Biology', credits: '1', grade: 'A-', level: 'ap' },
    { name: 'English 11', credits: '1', grade: 'B+', level: 'reg' },
    { name: 'Honours Pre-Calculus', credits: '1', grade: 'A', level: 'honors' },
    { name: 'US History', credits: '1', grade: 'B', level: 'reg' },
  ],
  compute: (rows) => compute(rows as unknown as Course[]),
  onRender(m) {
    text('gpa-un', m.counted ? m.unweighted.toFixed(2) : '—');
    text('gpa-w', m.counted ? m.weighted.toFixed(2) : '—');
    text('gpa-cr', m.counted ? String(m.totalCredits) : '—');
    text('gpa-sub', m.counted
      ? `${m.counted} course${m.counted === 1 ? '' : 's'} counted${m.ignored ? `, ${m.ignored} skipped` : ''}`
      : 'Add a credit value and a grade to begin');
    text('gpa-verdict', verdict(m));

    const body = document.getElementById('gpa-working');
    if (body) {
      body.innerHTML = m.counted
        ? m.breakdown.map((b) => `<div class="working__row">
             <span><strong>${b.name}</strong>
               <span class="working__note">${b.credits} credit${b.credits === 1 ? '' : 's'} · ${b.grade} · ${b.level}</span>
             </span>
             <span class="working__amt">${(b.points * b.credits).toFixed(2)}${b.weighted !== b.points ? ` <span style="color:var(--c-pop)">(${(b.weighted * b.credits).toFixed(2)} weighted)</span>` : ''}</span>
           </div>`).join('')
          + `<div class="working__row"><span><strong>Total quality points</strong>
               <span class="working__note">divided by ${m.totalCredits} credits</span></span>
             <span class="working__amt">${m.qualityPoints.toFixed(2)}</span></div>`
        : '<div class="working__row"><span>Nothing counted yet</span><span class="working__amt">—</span></div>';
    }

    const notes = document.getElementById('gpa-notes');
    if (!notes) return;
    const items: string[] = [];
    if (m.ignored > 0) {
      items.push(`<li><strong>${m.ignored} row${m.ignored === 1 ? ' was' : 's were'} skipped.</strong> A row counts only when it has a credit value above zero and a grade. Pass/fail courses belong out of the calculation anyway.</li>`);
    }
    if (m.weighted > 4) {
      items.push(`<li><strong>A weighted GPA above 4.0 is normal.</strong> That is what the weighting is for. It is not an error, and it is not directly comparable with an unweighted figure from another school.</li>`);
    }
    if (m.totalCredits > 0 && m.totalCredits < 3) {
      items.push(`<li><strong>This is a small sample.</strong> With ${m.totalCredits} credit${m.totalCredits === 1 ? '' : 's'} entered, one more course will move the average a long way. Enter a full term before reading much into it.</li>`);
    }
    if (!m.noWeighting) {
      items.push(`<li><strong>The weighting here is a convention, not a standard.</strong> This adds 0.5 for honours and 1.0 for AP, IB and dual enrolment. Your school's published scale beats ours, and plenty of schools do it differently.</li>`);
    }
    notes.innerHTML = items.length
      ? `<div class="note note--warn" style="margin-top:var(--s-5)"><strong class="note__title">Worth knowing</strong><ul style="margin:0;padding-left:1.1rem">${items.join('')}</ul></div>`
      : '';
  },
});
