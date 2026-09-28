import { runBacktest } from "./backtest";
import { computeMetrics } from "./metrics";
import type { IndexWindow, MarketData, Rebalance } from "./types";
import { PERIODS_PER_YEAR } from "./types";
import { lowerBound, windowLength } from "./window";

export type ReliabilityRating = "high" | "medium" | "low";

export interface AssetReliability {
  actualDays: number;
  backcastDays: number;
  actualShare: number;
  rating: ReliabilityRating;
}

/**
 * Share of the window covered by real fund history (the Reliability sheet):
 * days on/after the first actual date count as actual, earlier days are back-cast.
 */
export function assetReliability(dates: readonly string[], window: IndexWindow, inception: string | null): AssetReliability {
  const total = windowLength(window);
  const firstActual = inception ? Math.max(lowerBound(dates, inception), window.startIdx) : window.startIdx;
  const actualDays = Math.max(0, window.endIdx - firstActual + 1);
  const actualShare = total ? actualDays / total : 0;
  return {
    actualDays,
    backcastDays: total - actualDays,
    actualShare,
    rating: actualShare >= 0.98 ? "high" : actualShare >= 0.6 ? "medium" : "low",
  };
}

export type ReliabilityVerdict = "reliable" | "short" | "tooShort" | "empty";

export interface PortfolioReliability {
  /** Latest first-actual date among the assets the portfolio holds. */
  commonActualStart: string | null;
  actualDays: number;
  actualShare: number;
  fullCagr: number | null;
  /** CAGR measured only from the common actual start (null with less than a year). */
  actualCagr: number | null;
  /** fullCagr - actualCagr: how much the back-cast period changes the headline return. */
  backcastEffect: number | null;
  verdict: ReliabilityVerdict;
}

export function portfolioReliability(
  market: MarketData,
  weights: ArrayLike<number>,
  window: IndexWindow,
  inceptions: readonly (string | null)[],
  rebalance: Rebalance = "daily",
): PortfolioReliability {
  let start: string | null = null;
  for (let i = 0; i < market.tickers.length; i++) {
    if ((weights[i] ?? 0) > 0) {
      const inc = inceptions[i] ?? market.dates[0];
      if (start === null || inc > start) start = inc;
    }
  }
  const total = windowLength(window);
  const full = computeMetrics(runBacktest(market, weights, window, rebalance));
  if (start === null) {
    return {
      commonActualStart: null,
      actualDays: 0,
      actualShare: 0,
      fullCagr: full.cagr,
      actualCagr: null,
      backcastEffect: null,
      verdict: "empty",
    };
  }
  const actualWindow = { startIdx: Math.max(lowerBound(market.dates, start), window.startIdx), endIdx: window.endIdx };
  const actualDays = windowLength(actualWindow);
  let actualCagr: number | null = null;
  if (actualDays >= PERIODS_PER_YEAR) {
    actualCagr = computeMetrics(runBacktest(market, weights, actualWindow, rebalance)).cagr;
  }
  return {
    commonActualStart: start,
    actualDays,
    actualShare: total ? actualDays / total : 0,
    fullCagr: full.cagr,
    actualCagr,
    backcastEffect: actualCagr !== null && full.cagr !== null ? full.cagr - actualCagr : null,
    verdict: actualDays >= 2 * PERIODS_PER_YEAR ? "reliable" : actualDays >= PERIODS_PER_YEAR ? "short" : "tooShort",
  };
}
