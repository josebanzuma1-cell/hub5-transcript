/* Hub-specific configuration. Single source for nav, cards, footer,
   internal links, sitemap and JSON-LD. */

export const SITE = {
  name: 'Transcript',
  tagline: 'Your grades, and what the degree behind them costs',
  description:
    'Grade and student finance calculators that show their working: weighted ' +
    'and unweighted GPA, the mark you need on the final, and what your ' +
    'student loans actually cost once interest and repayment plan are in.',
  url: 'https://example.com', // TODO: real domain before launch
  locale: 'en_US',
} as const;

export interface Tool {
  slug: string;
  title: string;
  nav: string;
  blurb: string;
  /** the question a searcher actually types */
  question: string;
  planId: number;
  built: boolean;
  /** 'grades' is the top of the funnel; 'money' is where the value is */
  group: 'grades' | 'money';
}

/* The plan is explicit that grade tools bring the traffic and barely monetise,
   while the loan tools carry five to ten times the CPC. They are on one domain
   for exactly that reason: a student checking a GPA is one click from "what
   will this degree cost me". Every grade page links hard into the money
   group — see RelatedTools on each page. */
export const TOOLS: Tool[] = [
  {
    slug: 'gpa-calculator',
    title: 'GPA Calculator — Weighted and Unweighted',
    nav: 'GPA',
    question: 'What is my GPA?',
    blurb:
      'Add your courses and see both numbers at once. Weighted counts the ' +
      'extra credit an honours or AP course earns; unweighted is what most ' +
      'applications ask for.',
    planId: 20, built: true, group: 'grades',
  },
  {
    slug: 'final-grade-calculator',
    title: 'Grade Needed on the Final Exam',
    nav: 'Final grade',
    question: 'What do I need on the final?',
    blurb:
      'Enter what each part of the course is worth and what you have scored ' +
      'so far. It works out the mark the final has to carry — and says when ' +
      'the answer is that no mark will do it.',
    planId: 23, built: true, group: 'grades',
  },
  {
    slug: 'cumulative-gpa-calculator',
    title: 'Cumulative GPA Calculator',
    nav: 'Cumulative GPA',
    question: 'What will my GPA be after this term?',
    blurb:
      'Roll a new term into an existing record. You cannot average two GPAs — ' +
      'they have to be weighted by credits, and the difference is larger than ' +
      'most people expect.',
    planId: 21, built: true, group: 'grades',
  },
  {
    slug: 'gpa-scale-converter',
    title: 'GPA Scale Converter',
    nav: 'Scale converter',
    question: 'What is my grade on another scale?',
    blurb:
      'Between the US 4.0 scale, percentages, UK honours classifications, ECTS ' +
      'grades and the Indian 10-point CGPA — with a clear statement of why ' +
      'every one of these conversions is an approximation.',
    planId: 22, built: true, group: 'grades',
  },
  {
    slug: 'income-driven-repayment-calculator',
    title: 'Income-Driven Repayment Comparison',
    nav: 'Repayment plans',
    question: 'Which repayment plan should I be on?',
    blurb:
      'SAVE ended in March 2026 and RAP replaced it in July. This compares the ' +
      'plans you can actually enrol in — which depends on when you borrowed — ' +
      'rather than the ones calculators still list.',
    planId: 26, built: true, group: 'money',
  },
  {
    slug: 'college-cost-calculator',
    title: 'True Cost of College Calculator',
    nav: 'College cost',
    question: 'What will this degree actually cost?',
    blurb:
      'The sticker price is not the price. Works from the net price families ' +
      'at your income level actually pay at 142 large universities, then shows ' +
      'the debt, the repayment and what the degree returns.',
    planId: 27, built: true, group: 'money',
  },
  {
    slug: '529-savings-calculator',
    title: '529 College Savings Calculator',
    nav: '529 savings',
    question: 'How much should I be saving?',
    blurb:
      'What your contributions grow to, what the degree will cost by the time ' +
      'it starts, and what a year of delay costs. Aims at a realistic share of ' +
      'the total rather than the whole intimidating number.',
    planId: 28, built: true, group: 'money',
  },
  {
    slug: 'student-loan-payoff-calculator',
    title: 'Student Loan Payoff Calculator',
    nav: 'Loan payoff',
    question: 'When will my student loans be gone?',
    blurb:
      'List your loans individually rather than as one blended balance, ' +
      'because the order you attack them in changes the total by thousands. ' +
      'Compares avalanche, snowball and paying the minimum.',
    planId: 25, built: true, group: 'money',
  },
];

export const toolBySlug = (slug: string): Tool | undefined =>
  TOOLS.find((t) => t.slug === slug);
export const BUILT = TOOLS.filter((t) => t.built);
export const toolsExcept = (slug: string): Tool[] =>
  BUILT.filter((t) => t.slug !== slug);
/** Nav, cards and the sitemap only ever link to pages that exist. */
export const NAV = BUILT.map((t) => ({ href: `/tools/${t.slug}`, label: t.nav }));

/* Cross-group links are the whole point of the domain, so make them explicit
   rather than leaving them to a generic "related tools" shuffle. */
export const FUNNEL = BUILT.filter((t) => t.group === 'money');
