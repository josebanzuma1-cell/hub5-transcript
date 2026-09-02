/* Provenance for every figure this hub publishes.

   Hub 5 shipped with none — a GPA is computed entirely from what the reader
   enters, and the grade scale is a convention rather than a published figure.
   The repayment tools changed that: poverty guidelines and plan formulas are
   federal, published, and change annually, so they get the same treatment as
   every other data set in the portfolio. */

export interface Provenance {
  /** ISO date the figure was last checked against the source */
  checkedOn: string;
  /** the primary source — a publisher and document, not "the internet" */
  source: string;
  /** who checked it */
  by: string;
}

export type Verified = Provenance | false;

/** A check older than this is treated as stale by scripts/check-data.mjs. */
export const MAX_AGE_DAYS = 400;
