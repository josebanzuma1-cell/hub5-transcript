/* A roster: a table of rows the reader adds to and removes from, as the
   primary input to a calculator.

   Deliberately NOT part of the kit. The kit's engine binds a fixed set of
   named fields, which is right for every other hub — a mortgage has one
   balance, a paycheck one salary. This hub's inputs are lists: courses,
   graded components, individual loans. Extending the engine to handle a
   variable number of rows would have meant changing a file that must stay
   byte-identical across five hubs, to serve one of them.

   What it still has to provide, because the portfolio depends on it: a
   shareable URL. Rows are encoded compactly into one query parameter, so a
   result can be sent to someone the way every other tool's can. */

export interface RosterColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  /** for select columns */
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  /** CSS grid track, e.g. '1fr' or '90px' */
  width: string;
  default: string;
  /** right-align numerics */
  numeric?: boolean;
}

export type Row = Record<string, string>;

export interface RosterConfig<R> {
  /** must match data-roster on the root element */
  id: string;
  columns: RosterColumn[];
  /** rows shown on a clean load — pick ones that produce a useful answer */
  seed: Row[];
  compute: (rows: Row[]) => R;
  onRender: (result: R, rows: Row[]) => void;
  /** query parameter the rows are encoded into; keep it to one or two chars */
  param: string;
  minRows?: number;
  maxRows?: number;
}

/* Field and row separators chosen because neither survives in ordinary course
   names or loan nicknames, and neither needs percent-encoding. */
const FS = '~';
const RS = '!';

const encode = (rows: Row[], cols: RosterColumn[]): string =>
  rows.map((r) => cols.map((c) => String(r[c.key] ?? '').replace(/[~!]/g, ' ')).join(FS)).join(RS);

function decode(raw: string, cols: RosterColumn[]): Row[] {
  return raw.split(RS).filter(Boolean).map((chunk) => {
    const parts = chunk.split(FS);
    const row: Row = {};
    cols.forEach((c, i) => { row[c.key] = parts[i] ?? c.default; });
    return row;
  });
}

export function mountRoster<R>(config: RosterConfig<R>): void {
  const root = document.querySelector<HTMLElement>(`[data-roster="${config.id}"]`);
  const body = root?.querySelector<HTMLElement>('[data-roster-body]');
  if (!root || !body) return;

  const min = config.minRows ?? 1;
  const max = config.maxRows ?? 40;

  const fromUrl = new URLSearchParams(location.search).get(config.param);
  let rows: Row[] = fromUrl ? decode(fromUrl, config.columns) : config.seed.map((r) => ({ ...r }));
  if (!rows.length) rows = config.seed.map((r) => ({ ...r }));

  let urlTimer = 0;
  let frame = 0;

  function render() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      config.onRender(config.compute(rows), rows);
      root!.dataset.state = 'ready';
    });
    clearTimeout(urlTimer);
    urlTimer = window.setTimeout(() => {
      const url = new URL(location.href);
      // A pristine roster keeps a clean URL, so the canonical stays tidy.
      const isSeed = encode(rows, config.columns) === encode(config.seed, config.columns);
      if (isSeed) url.searchParams.delete(config.param);
      else url.searchParams.set(config.param, encode(rows, config.columns));
      history.replaceState(history.state, '', url.pathname + (url.search || '') );
    }, 400);
  }

  function cell(col: RosterColumn, value: string, r: number): string {
    const id = `${config.id}-${r}-${col.key}`;
    if (col.type === 'select') {
      const opts = (col.options ?? [])
        .map((o) => `<option value="${o.value}"${o.value === value ? ' selected' : ''}>${o.label}</option>`)
        .join('');
      return `<select class="select roster__input" id="${id}" data-r="${r}" data-k="${col.key}"
        aria-label="${col.label}, row ${r + 1}">${opts}</select>`;
    }
    return `<input class="input roster__input${col.numeric ? ' roster__input--num' : ''}" id="${id}"
      type="text" inputmode="${col.type === 'number' ? 'decimal' : 'text'}"
      value="${value.replace(/"/g, '&quot;')}" data-r="${r}" data-k="${col.key}"
      placeholder="${col.placeholder ?? ''}" aria-label="${col.label}, row ${r + 1}" />`;
  }

  function paint() {
    body!.innerHTML = rows.map((row, r) => `
      <div class="roster__row" data-row="${r}">
        ${config.columns.map((c) => `<div class="roster__cell">${cell(c, row[c.key] ?? c.default, r)}</div>`).join('')}
        <div class="roster__cell roster__cell--act">
          <button type="button" class="roster__del" data-del="${r}"
            aria-label="Remove row ${r + 1}"${rows.length <= min ? ' disabled' : ''}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      </div>`).join('');
    const add = root!.querySelector<HTMLButtonElement>('[data-roster-add]');
    if (add) add.disabled = rows.length >= max;
  }

  root.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (!el.dataset.k) return;
    rows[Number(el.dataset.r)][el.dataset.k] = el.value;
    render();
  });
  root.addEventListener('change', (e) => {
    const el = e.target as HTMLSelectElement;
    if (!el.dataset.k) return;
    rows[Number(el.dataset.r)][el.dataset.k] = el.value;
    render();
  });

  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const del = t.closest<HTMLElement>('[data-del]');
    if (del && rows.length > min) {
      rows.splice(Number(del.dataset.del), 1);
      paint(); render(); return;
    }
    if (t.closest('[data-roster-add]') && rows.length < max) {
      rows.push(Object.fromEntries(config.columns.map((c) => [c.key, c.default])) as Row);
      paint(); render();
      // Focus the first cell of the new row: adding a row means you intend
      // to type in it, and making people click again is a small rudeness.
      root.querySelector<HTMLElement>(`#${config.id}-${rows.length - 1}-${config.columns[0].key}`)?.focus();
      return;
    }
    if (t.closest('[data-roster-reset]')) {
      rows = config.seed.map((r) => ({ ...r }));
      history.replaceState(history.state, '', location.pathname);
      paint(); render();
    }
  });

  paint();
  // First paint is synchronous: the result card is above the fold.
  config.onRender(config.compute(rows), rows);
  root.dataset.state = 'ready';
}
