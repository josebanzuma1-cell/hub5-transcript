/* Data verification gate. Runs before every build.

   This hub is the first in the portfolio with almost NO external data, and
   that is a property of the subject rather than an omission. A GPA is computed
   entirely from what the reader enters. Grade points and the honours/AP
   weighting are conventions, not published figures — there is no authority to
   check them against, which is precisely why the pages say a school's own
   scale is the authority instead of claiming ours is.

   So this gate checks internal consistency rather than provenance: that the
   grade scale is ordered and bounded, that the weighting is sane, and that
   nothing has been quietly edited into an impossible state. */
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('@kit/')) return next(pathToFileURL(path.join(root, 'src/kit', spec.slice(5) + '.ts')).href, ctx);
    return next(spec, ctx);
  },
});
const { GRADES, LEVELS } = await import(pathToFileURL(path.join(root, 'src/lib/tools/gpa.ts')).href);

const problems = [];

if (!GRADES.length) problems.push('grade scale is empty');
if (Math.max(...GRADES.map((g) => g.points)) !== 4) {
  problems.push('the unweighted scale must top out at 4.0 — a higher ceiling inflates every GPA');
}
if (Math.min(...GRADES.map((g) => g.points)) !== 0) problems.push('the scale must bottom out at 0.0');
for (let i = 1; i < GRADES.length; i++) {
  if (GRADES[i].points > GRADES[i - 1].points) {
    problems.push(`grade scale is out of order at ${GRADES[i].id}`);
  }
}
const aPlus = GRADES.find((g) => g.id === 'A+');
const a = GRADES.find((g) => g.id === 'A');
if (aPlus && a && aPlus.points !== a.points) {
  problems.push('A+ must equal A at 4.0 — awarding 4.3 inflates a GPA in the direction nobody checks');
}

if (!LEVELS.some((l) => l.bonus === 0)) problems.push('there must be an unweighted level');
for (const l of LEVELS) {
  if (l.bonus < 0 || l.bonus > 2) problems.push(`implausible weighting bonus for ${l.id}: ${l.bonus}`);
}

console.log(`  grade scale: ${GRADES.length} grades, ${LEVELS.length} course levels`);
console.log('  external data: none — every figure comes from the reader');

if (problems.length) {
  console.error('\nStructural problems:');
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('  no structural problems');
