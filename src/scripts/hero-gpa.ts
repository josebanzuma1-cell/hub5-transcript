/* The hero calculator. Three fixed rows, so it does not need the roster
   manager — it is a demonstration, not the tool. Deliberately shares the same
   compute() as the real page: a hero that used its own arithmetic could drift
   from the product it is advertising. */
import { compute, type Course } from '../lib/tools/gpa';

const root = document.getElementById('tryit');
if (root) {
  const read = (): Course[] => {
    const rows: Course[] = [];
    const level = root.querySelector<HTMLSelectElement>('[data-t="level"]')?.value ?? 'reg';
    for (let i = 0; i < 3; i++) {
      const get = (t: string) =>
        root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-t="${t}"][data-i="${i}"]`)?.value ?? '';
      rows.push({ name: get('name'), credits: get('credits'), grade: get('grade'), level });
    }
    return rows;
  };

  const paint = () => {
    const m = compute(read());
    const un = document.getElementById('tryit-un');
    const w = document.getElementById('tryit-w');
    const note = document.getElementById('tryit-note');
    if (un) un.textContent = m.counted ? m.unweighted.toFixed(2) : '—';
    if (w) w.textContent = m.counted ? m.weighted.toFixed(2) : '—';
    if (note) {
      note.textContent = m.noWeighting
        ? 'Set the level to Honours or AP and watch the weighted figure pull away from the unweighted one.'
        : `Weighting adds ${m.weightBonus.toFixed(2)} here. The full calculator takes as many courses as you need and keeps the working.`;
    }
  };

  root.addEventListener('input', paint);
  root.addEventListener('change', paint);
  paint();
}
