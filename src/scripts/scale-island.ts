/* Client island for the grade scale converter.

   Not a roster — this takes one grade, not a list — but it reuses the desk
   layout so the hub reads as one product. Small enough to wire by hand. */
import { compute, SCALES, type ScaleId } from '../lib/tools/scale';

const val = () => (document.getElementById('sc-value') as HTMLInputElement | null)?.value ?? '';
const from = () => ((document.getElementById('sc-from') as HTMLSelectElement | null)?.value ?? 'us4') as ScaleId;
const text = (id: string, s: string) => {
  const el = document.getElementById(id);
  if (el) el.textContent = s;
};

function paint(): void {
  const f = from();
  const m = compute(val(), f);

  text('sc-points', m.valid ? m.points.toFixed(2) : '—');
  text('sc-sub', m.valid
    ? `entered as ${SCALES[f].name}`
    : `Not a valid ${SCALES[f].name} value`);

  const out = document.getElementById('sc-out');
  if (out) {
    out.innerHTML = m.conversions
      .filter((c) => c.scale !== f)
      .map((c) => `<div class="working__row"${c.notDerivable ? ' style="opacity:.75"' : ''}>
          <span><strong>${c.name}</strong>
            <span class="working__note">${c.note}</span></span>
          <span class="working__amt">${c.display ?? 'Cannot be derived'}</span>
        </div>`).join('');
  }

  const v = document.getElementById('sc-verdict');
  if (!v) return;
  if (!m.valid) {
    v.textContent = `That is not a value this scale uses. ${SCALES[f].note}`;
    return;
  }
  const uk = m.conversions.find((c) => c.scale === 'uk');
  const us = m.conversions.find((c) => c.scale === 'us4');
  if (f === 'uk') {
    v.innerHTML = `A UK ${val().replace(/[^\d.]/g, '')} is <strong>${uk?.label ?? ''}</strong>, which most evaluators place near <strong>${us?.display ?? ''}</strong> on the US 4.0 scale. Note what it is <em>not</em>: a US percentage of the same number would be a C. The two scales share a symbol and nothing else.`;
  } else if (f === 'uspct') {
    v.innerHTML = `A US ${val().replace(/[^\d.]/g, '')}% sits near <strong>${us?.display ?? ''}</strong> on the 4.0 scale and reads as <strong>${uk?.label ?? ''}</strong> in the UK system — where the equivalent mark is a much lower number, because British marking is compressed at the top.`;
  } else {
    v.innerHTML = `That is roughly <strong>${uk?.label ?? ''}</strong> in the UK system and <strong>${m.conversions.find((c) => c.scale === 'uspct')?.display ?? ''}</strong> as a US percentage. Quote the band rather than the midpoint — it is both more honest and harder to argue with.`;
  }
}

document.getElementById('sc-value')?.addEventListener('input', paint);
document.getElementById('sc-from')?.addEventListener('change', paint);
paint();
document.querySelector<HTMLElement>('[data-roster="scale"]')?.setAttribute('data-state', 'ready');
