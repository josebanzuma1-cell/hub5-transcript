/* Tool 23 — the mark you need on the final.

   The arithmetic is trivial. The reason this tool exists is the two answers
   people are not expecting, and which most versions of it hide:

     1. The mark required is above 100. No score on the final reaches the
        target. Saying "you need 118%" is technically true and useless; the
        page says the target is out of reach and shows the best still available.
     2. The mark required is at or below zero. The grade is already secured.
        A student revising for an exam they cannot fail deserves to know.

   Both are common at the point in term when people search for this, which is
   exactly why a tool that only prints a number is doing them a disservice. */

export interface Component {
  name: string;
  weight: string;
  score: string;
}

export interface FinalGradeModel {
  /** weight of everything already graded, as a percentage of the course */
  gradedWeight: number;
  /** weight left for the final */
  remainingWeight: number;
  /** the marks earned so far, expressed as a share of the WHOLE course */
  earnedSoFar: number;
  /** where you stand if the final counted for nothing */
  currentGrade: number;
  /** score the final must carry to reach the target */
  needed: number;
  target: number;
  /** the best final grade still achievable, i.e. 100 on the final */
  bestPossible: number;
  /** the grade if the final is skipped entirely */
  worstPossible: number;
  outcome: 'reachable' | 'impossible' | 'secured' | 'no-final';
  counted: number;
  ignored: number;
  breakdown: Array<{ name: string; weight: number; score: number; contributes: number }>;
}

export function computeWith(rows: Component[], target: number): FinalGradeModel {
  let gradedWeight = 0;
  let earned = 0;
  let counted = 0;
  let ignored = 0;
  const breakdown: FinalGradeModel['breakdown'] = [];

  for (const r of rows) {
    const w = Number(String(r.weight).replace(/[^\d.]/g, ''));
    const sRaw = String(r.score).replace(/[^\d.]/g, '');
    if (!(w > 0)) { ignored++; continue; }
    if (sRaw === '') { ignored++; continue; }
    const s = Number(sRaw);
    if (!Number.isFinite(s)) { ignored++; continue; }
    gradedWeight += w;
    earned += (s / 100) * w;
    counted++;
    breakdown.push({ name: r.name?.trim() || `Item ${counted}`, weight: w, score: s, contributes: (s / 100) * w });
  }

  const remainingWeight = Math.max(0, 100 - gradedWeight);
  const currentGrade = gradedWeight > 0 ? (earned / gradedWeight) * 100 : 0;
  const bestPossible = earned + remainingWeight;
  const worstPossible = earned;

  /* needed = (target - what you already hold) / what the final is worth.
     When the final is worth nothing the equation has no solution, which is a
     real state — the course is over — not an error. */
  const needed = remainingWeight > 0 ? ((target - earned) / remainingWeight) * 100 : NaN;

  let outcome: FinalGradeModel['outcome'];
  if (remainingWeight <= 0) outcome = 'no-final';
  else if (needed > 100) outcome = 'impossible';
  else if (needed <= 0) outcome = 'secured';
  else outcome = 'reachable';

  return {
    gradedWeight, remainingWeight, earnedSoFar: earned, currentGrade,
    needed, target, bestPossible, worstPossible, outcome,
    counted, ignored, breakdown,
  };
}
