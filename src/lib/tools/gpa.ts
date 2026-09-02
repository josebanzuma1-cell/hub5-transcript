/* Tool 20 — GPA, weighted and unweighted.

   Both numbers are always shown, because which one you need depends entirely
   on who is asking and most students do not know that. Unweighted is what the
   Common Application recalculates and what most scholarship formulas use.
   Weighted is what a high school puts on its own transcript and what class
   rank is usually built from. A tool that reports one of them silently picks
   a side of a question the reader did not know existed.

   The weighting is the honest difficulty here. There is no national standard:
   a school might add 0.5 for honours and 1.0 for AP, or 1.0 for both, or use
   a 5.0 scale throughout, or weight only some departments. This model applies
   the common +0.5 / +1.0 convention and says on the page that a school's own
   scale is the authority. It does not pretend the number it produces is the
   one on the transcript. */

export const GRADES = [
  { id: 'A+', points: 4.0 }, { id: 'A', points: 4.0 }, { id: 'A-', points: 3.7 },
  { id: 'B+', points: 3.3 }, { id: 'B', points: 3.0 }, { id: 'B-', points: 2.7 },
  { id: 'C+', points: 2.3 }, { id: 'C', points: 2.0 }, { id: 'C-', points: 1.7 },
  { id: 'D+', points: 1.3 }, { id: 'D', points: 1.0 }, { id: 'D-', points: 0.7 },
  { id: 'F',  points: 0.0 },
] as const;

/* A+ is 4.0 here, not 4.3. Most US institutions cap the unweighted scale at
   4.0 and treat A+ as an A; schools that award 4.3 are the exception. Getting
   this wrong inflates a GPA in the direction the reader wants, which is the
   worst direction to be wrong in. */

export const LEVELS = [
  { id: 'reg',    label: 'Regular',  bonus: 0.0 },
  { id: 'honors', label: 'Honours',  bonus: 0.5 },
  { id: 'ap',     label: 'AP / IB',  bonus: 1.0 },
  { id: 'de',     label: 'Dual enrolment', bonus: 1.0 },
] as const;

export interface Course {
  name: string;
  credits: string;
  grade: string;
  level: string;
}

export interface GpaModel {
  unweighted: number;
  weighted: number;
  totalCredits: number;
  /** courses that contributed — a row with no credits or no grade is ignored */
  counted: number;
  ignored: number;
  /** how much the weighting added, in GPA points */
  weightBonus: number;
  /** points earned and points possible, for the working-out panel */
  qualityPoints: number;
  possiblePoints: number;
  /** true when every course is regular, so the two numbers are identical */
  noWeighting: boolean;
  breakdown: Array<{
    name: string; credits: number; grade: string; level: string;
    points: number; weighted: number;
  }>;
}

const pointsFor = (g: string): number | null => {
  const hit = GRADES.find((x) => x.id === g.trim().toUpperCase());
  return hit ? hit.points : null;
};
const bonusFor = (l: string): number => LEVELS.find((x) => x.id === l)?.bonus ?? 0;

export function compute(rows: Course[]): GpaModel {
  let qp = 0;         // quality points, unweighted
  let wqp = 0;        // quality points, weighted
  let credits = 0;
  let counted = 0;
  let ignored = 0;
  const breakdown: GpaModel['breakdown'] = [];
  let anyWeighted = false;

  for (const r of rows) {
    const c = Number(String(r.credits).replace(/[^\d.]/g, ''));
    const p = pointsFor(r.grade ?? '');
    if (!(c > 0) || p === null) { ignored++; continue; }
    const bonus = bonusFor(r.level);
    if (bonus > 0) anyWeighted = true;
    /* The bonus lifts the grade, but a weighted GPA is still capped by the
       scale's own ceiling per course only in schools that cap it — most do
       not, which is why a weighted GPA above 4.0 is normal and expected. */
    const w = p + bonus;
    qp += p * c;
    wqp += w * c;
    credits += c;
    counted++;
    breakdown.push({
      name: r.name?.trim() || `Course ${counted}`,
      credits: c, grade: r.grade.trim().toUpperCase(),
      level: LEVELS.find((x) => x.id === r.level)?.label ?? 'Regular',
      points: p, weighted: w,
    });
  }

  const unweighted = credits > 0 ? qp / credits : 0;
  const weighted = credits > 0 ? wqp / credits : 0;
  return {
    unweighted, weighted,
    totalCredits: credits,
    counted, ignored,
    weightBonus: weighted - unweighted,
    qualityPoints: qp,
    possiblePoints: credits * 4,
    noWeighting: !anyWeighted,
    breakdown,
  };
}

/** Cumulative GPA when a new term is added to an existing record. */
export function cumulative(
  priorGpa: number, priorCredits: number, termGpa: number, termCredits: number,
): number {
  const total = priorCredits + termCredits;
  if (total <= 0) return 0;
  return (priorGpa * priorCredits + termGpa * termCredits) / total;
}
