/* Tool 22 — converting a grade between national scales.

   The honest position, stated on the page and built into the output: THESE
   ARE NOT CONVERSIONS. There is no authority that defines what a UK 2:1 is
   worth on a US 4.0 scale. Every credential evaluator, every university
   admissions office and every scholarship body publishes its own table, and
   they disagree with each other.

   Two specific traps this is built to avoid:

     1. Percentages do not travel. A UK 70 is a First — the top classification
        — and a US 70 is a C. Mapping percentage to percentage is the single
        most common and most damaging error, because it silently converts an
        excellent degree into a mediocre one.
     2. ECTS is a DISTRIBUTION grade, not an absolute one. An ECTS A means the
        top 10% of the cohort, whatever mark that took. It cannot be derived
        from your mark alone, and this tool refuses to pretend otherwise.

   So the output is a band with a stated source convention, not a number. */

export type ScaleId = 'us4' | 'uspct' | 'uk' | 'india10' | 'ects';

export interface Band {
  /** inclusive lower bound on the canonical 4.0 scale */
  from: number;
  /** exclusive upper bound, except for the top band */
  to: number;
  label: string;
  /** what to show as the value in this scale */
  display: string;
}

/* Everything routes through the US 4.0 point as a hub, because it is the
   scale most of these tables are written against — not because it is
   privileged in any other sense. */
export const SCALES: Record<ScaleId, { name: string; note: string; bands: Band[] }> = {
  us4: {
    name: 'US 4.0 GPA',
    note: 'The standard American scale. A+ and A both count 4.0 at most institutions.',
    bands: [
      { from: 3.85, to: 4.01, label: 'A',  display: '3.85 – 4.00' },
      { from: 3.50, to: 3.85, label: 'A-', display: '3.50 – 3.84' },
      { from: 3.15, to: 3.50, label: 'B+', display: '3.15 – 3.49' },
      { from: 2.85, to: 3.15, label: 'B',  display: '2.85 – 3.14' },
      { from: 2.50, to: 2.85, label: 'B-', display: '2.50 – 2.84' },
      { from: 2.15, to: 2.50, label: 'C+', display: '2.15 – 2.49' },
      { from: 1.85, to: 2.15, label: 'C',  display: '1.85 – 2.14' },
      { from: 1.00, to: 1.85, label: 'D',  display: '1.00 – 1.84' },
      { from: 0.00, to: 1.00, label: 'F',  display: '0.00 – 0.99' },
    ],
  },
  uspct: {
    name: 'US percentage',
    note: 'American percentage marking, where 90 and above is an A. Do NOT compare this with a British percentage — they are different measurements that happen to share a symbol.',
    bands: [
      { from: 3.85, to: 4.01, label: '93–100%', display: '93 – 100%' },
      { from: 3.50, to: 3.85, label: '90–92%',  display: '90 – 92%' },
      { from: 3.15, to: 3.50, label: '87–89%',  display: '87 – 89%' },
      { from: 2.85, to: 3.15, label: '83–86%',  display: '83 – 86%' },
      { from: 2.50, to: 2.85, label: '80–82%',  display: '80 – 82%' },
      { from: 2.15, to: 2.50, label: '77–79%',  display: '77 – 79%' },
      { from: 1.85, to: 2.15, label: '73–76%',  display: '73 – 76%' },
      { from: 1.00, to: 1.85, label: '60–72%',  display: '60 – 72%' },
      { from: 0.00, to: 1.00, label: 'Below 60%', display: 'Below 60%' },
    ],
  },
  uk: {
    name: 'UK honours',
    note: 'British degree classification. A UK 70 is a First — the top class — not a C. British marking rarely goes above 80, and a mark in the 90s is close to unheard of.',
    bands: [
      { from: 3.70, to: 4.01, label: 'First (1st)',        display: 'First — 70%+' },
      { from: 3.00, to: 3.70, label: 'Upper second (2:1)', display: '2:1 — 60–69%' },
      { from: 2.30, to: 3.00, label: 'Lower second (2:2)', display: '2:2 — 50–59%' },
      { from: 1.70, to: 2.30, label: 'Third',              display: 'Third — 40–49%' },
      { from: 0.00, to: 1.70, label: 'Fail',               display: 'Fail — below 40%' },
    ],
  },
  india10: {
    name: 'India 10-point CGPA',
    note: 'The CGPA used by most Indian universities. A common rule of thumb multiplies CGPA by 9.5 to get a percentage, but the multiplier differs by institution — CBSE uses 9.5, many universities do not.',
    bands: [
      { from: 3.85, to: 4.01, label: '9.0 – 10.0', display: '9.0 – 10.0' },
      { from: 3.50, to: 3.85, label: '8.5 – 8.9',  display: '8.5 – 8.9' },
      { from: 3.15, to: 3.50, label: '8.0 – 8.4',  display: '8.0 – 8.4' },
      { from: 2.85, to: 3.15, label: '7.5 – 7.9',  display: '7.5 – 7.9' },
      { from: 2.50, to: 2.85, label: '7.0 – 7.4',  display: '7.0 – 7.4' },
      { from: 2.15, to: 2.50, label: '6.5 – 6.9',  display: '6.5 – 6.9' },
      { from: 1.85, to: 2.15, label: '6.0 – 6.4',  display: '6.0 – 6.4' },
      { from: 1.00, to: 1.85, label: '5.0 – 5.9',  display: '5.0 – 5.9' },
      { from: 0.00, to: 1.00, label: 'Below 5.0',  display: 'Below 5.0' },
    ],
  },
  ects: {
    name: 'ECTS',
    note: 'ECTS grades describe your POSITION IN THE COHORT, not your mark: A is the top 10% of those who passed, B the next 25%, C the next 30%. It cannot be derived from a mark alone, and any tool that claims otherwise is guessing.',
    bands: [],
  },
};

export interface Conversion {
  scale: ScaleId;
  name: string;
  /** the band this grade falls in, or null where the scale cannot say */
  display: string | null;
  label: string | null;
  note: string;
  /** true where the scale is a distribution rather than a measurement */
  notDerivable: boolean;
}

export interface ScaleModel {
  /** the input expressed on the canonical 4.0 scale */
  points: number;
  valid: boolean;
  from: ScaleId;
  conversions: Conversion[];
}

/** Parse a value in a given scale into canonical 4.0 points. */
export function toPoints(raw: string, from: ScaleId): number | null {
  const s = String(raw ?? '').trim().toUpperCase();
  if (!s) return null;

  /* Number("") is 0, so stripping non-numerics from rubbish yields a clean
     zero rather than a rejection. Reject before parsing. */
  const digits = s.replace(/[^0-9.]/g, "");
  if (!digits || !/[0-9]/.test(digits)) return null;

  if (from === 'us4') {
    const n = Number(s.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n >= 0 && n <= 4.3 ? Math.min(4, n) : null;
  }
  if (from === 'uspct' || from === 'uk') {
    const n = Number(s.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    const bands = SCALES[from].bands;
    /* Walk the band table backwards from the input's own scale. The bands
       carry the percentage ranges in their labels, so find which one the mark
       falls in and return the midpoint of that band's 4.0 range. */
    const ranges: Array<[number, number, number, number]> = from === 'uspct'
      ? [[93, 100, 3.85, 4.0], [90, 92, 3.5, 3.84], [87, 89, 3.15, 3.49], [83, 86, 2.85, 3.14],
         [80, 82, 2.5, 2.84], [77, 79, 2.15, 2.49], [73, 76, 1.85, 2.14], [60, 72, 1.0, 1.84], [0, 59, 0, 0.99]]
      : [[70, 100, 3.7, 4.0], [60, 69, 3.0, 3.69], [50, 59, 2.3, 2.99], [40, 49, 1.7, 2.29], [0, 39, 0, 1.69]];
    const hit = ranges.find(([lo, hi]) => n >= lo && n <= hi);
    if (!hit) return null;
    const [lo, hi, plo, phi] = hit;
    return hi === lo ? plo : plo + ((n - lo) / (hi - lo)) * (phi - plo);
  }
  if (from === 'india10') {
    const n = Number(s.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n < 0 || n > 10) return null;
    /* Read the band table backwards rather than interpolating linearly. A
       linear formula disagreed with the table it is meant to invert: India
       8.7 came back as 3.22 while the table maps 8.5-8.9 to 3.50-3.84. A
       converter whose round trip does not close is telling two stories. */
    const ranges: Array<[number, number, number, number]> = [
      [9.0, 10.0, 3.85, 4.0], [8.5, 8.9, 3.5, 3.84], [8.0, 8.4, 3.15, 3.49],
      [7.5, 7.9, 2.85, 3.14], [7.0, 7.4, 2.5, 2.84], [6.5, 6.9, 2.15, 2.49],
      [6.0, 6.4, 1.85, 2.14], [5.0, 5.9, 1.0, 1.84], [0, 4.99, 0, 0.99],
    ];
    const hit = ranges.find(([lo, hi]) => n >= lo && n <= hi);
    if (!hit) return null;
    const [lo, hi, plo, phi] = hit;
    return hi === lo ? plo : plo + ((n - lo) / (hi - lo)) * (phi - plo);
  }
  return null;
}

const bandFor = (points: number, scale: ScaleId): Band | null =>
  SCALES[scale].bands.find((b) => points >= b.from && points < b.to)
    ?? (points >= 4 ? SCALES[scale].bands[0] ?? null : null);

export function compute(raw: string, from: ScaleId): ScaleModel {
  const points = toPoints(raw, from);
  const valid = points !== null;
  const p = points ?? 0;

  const conversions: Conversion[] = (Object.keys(SCALES) as ScaleId[]).map((id) => {
    const scale = SCALES[id];
    if (id === 'ects') {
      /* Refusing to answer is the answer. ECTS ranks you against the people
         who sat the same exam; no mark determines it. */
      return { scale: id, name: scale.name, display: null, label: null, note: scale.note, notDerivable: true };
    }
    const band = valid ? bandFor(p, id) : null;
    return {
      scale: id, name: scale.name,
      display: band ? band.display : null,
      label: band ? band.label : null,
      note: scale.note,
      notDerivable: false,
    };
  });

  return { points: p, valid, from, conversions };
}
