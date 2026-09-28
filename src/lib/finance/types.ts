/** Trading days per year used by every annualisation in the workbook. */
export const PERIODS_PER_YEAR = 252;

export type Rebalance = "daily" | "monthly" | "quarterly" | "annually" | "none";

/**
 * Daily total-return panel, aligned on a common trading calendar.
 * Blank workbook cells (e.g. SPSK before inception) are stored as NaN.
 */
export interface MarketData {
  dates: string[];
  tickers: string[];
  returns: Float64Array[];
}

/** Inclusive ISO-date bounds; a missing side means "from the first / to the last available day". */
export interface DateWindow {
  start?: string | null;
  end?: string | null;
}

/** Inclusive index bounds into `MarketData.dates`; empty when `startIdx > endIdx`. */
export interface IndexWindow {
  startIdx: number;
  endIdx: number;
}
