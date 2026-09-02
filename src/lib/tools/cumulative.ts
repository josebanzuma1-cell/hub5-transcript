/* Tool 21 — cumulative GPA across terms.

   The error this exists to prevent: you cannot average two GPAs. A 3.0 over
   sixty credits and a 4.0 over thirty is not 3.5 — it is 3.33, because the
   first term is twice the weight. Students routinely plan around the wrong
   number, and the direction of the error is always optimistic.

   The second thing it does is answer the planning question in reverse: given
   where you are and where you want to be, what does the coming term have to
   average? That answer is frequently above 4.0, which is the useful part —
   it means the target is unreachable this term, and better learned now. */

export interface Term {
  name: string;
  credits: string;
  gpa: string;
}

export interface CumulativeModel {
  cumulative: number;
  totalCredits: number;
  counted: number;
  ignored: number;
  /** each term with its running cumulative after that term */
  progression: Array<{ name: string; credits: number; gpa: number; runningGpa: number; runningCredits: number }>;
  /** the target the reader is aiming for */
  target: number;
  /** credits planned for the coming term */
  plannedCredits: number;
  /** GPA the coming term must average to hit the target */
  needed: number;
  outcome: 'reachable' | 'impossible' | 'already-there' | 'no-plan';
  /** best cumulative achievable with a perfect coming term */
  bestPossible: number;
}

export function computeWith(rows: Term[], target: number, plannedCredits: number): CumulativeModel {
  let qp = 0;
  let credits = 0;
  let counted = 0;
  let ignored = 0;
  const progression: CumulativeModel['progression'] = [];

  for (const r of rows) {
    const c = Number(String(r.credits).replace(/[^\d.]/g, ''));
    const g = Number(String(r.gpa).replace(/[^\d.]/g, ''));
    if (!(c > 0) || !Number.isFinite(g) || String(r.gpa).trim() === '') { ignored++; continue; }
    qp += g * c;
    credits += c;
    counted++;
    progression.push({
      name: r.name?.trim() || `Term ${counted}`,
      credits: c, gpa: g,
      runningGpa: qp / credits,
      runningCredits: credits,
    });
  }

  const cum = credits > 0 ? qp / credits : 0;

  /* Solve for the coming term: (current points + needed x planned) / (total
     credits) = target. The answer can exceed 4.0, and when it does that is
     the finding rather than an error. */
  let needed = NaN;
  let outcome: CumulativeModel['outcome'] = 'no-plan';
  let bestPossible = cum;
  if (plannedCredits > 0 && credits >= 0) {
    const totalAfter = credits + plannedCredits;
    needed = (target * totalAfter - qp) / plannedCredits;
    bestPossible = (qp + 4 * plannedCredits) / totalAfter;
    if (needed <= 0) outcome = 'already-there';
    else if (needed > 4) outcome = 'impossible';
    else outcome = 'reachable';
  }

  return {
    cumulative: cum,
    totalCredits: credits,
    counted, ignored, progression,
    target, plannedCredits, needed, outcome, bestPossible,
  };
}
