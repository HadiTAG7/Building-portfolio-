import type { IndexWindow, MarketData, Rebalance } from "./types";
import { windowLength } from "./window";

export interface Backtest {
  /** Dates of the simulated window. */
  dates: string[];
  /** Portfolio return for each day. */
  returns: Float64Array;
  /** Growth of 1 at the close of each day (the value before the first day is 1). */
  wealth: Float64Array;
  /** Wealth relative to its running peak, minus 1. The starting value of 1 counts as a peak. */
  drawdown: Float64Array;
  /**
   * Per-asset contribution to the cumulative return, in the same order as `MarketData.tickers`.
   * Sum_i W(t-1) * w_i(t) * r_i(t) over the window, so the contributions add up exactly to
   * `wealth[last] - 1` (the decomposition used in the workbook's "portfolio growth proof" sheet).
   */
  contributions: Float64Array;
  /** Share of capital left unallocated (weights summing below 100%) and earning 0%. */
  cashWeight: number;
}

function periodKey(date: string, rebalance: Rebalance): string {
  switch (rebalance) {
    case "monthly":
      return date.slice(0, 7);
    case "quarterly":
      return `${date.slice(0, 4)}Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3)}`;
    case "annually":
      return date.slice(0, 4);
    default:
      return "";
  }
}

/**
 * Simulate a fixed-weight portfolio over a window.
 *
 * `daily` reproduces the workbook exactly: each day's return is
 * SUMPRODUCT(asset returns, weights), with blank asset returns counted as 0.
 * The other modes let weights drift with prices and reset them to target on the
 * first trading day of each new month / quarter / year (`none` = buy and hold).
 */
export function runBacktest(
  market: MarketData,
  weights: ArrayLike<number>,
  window: IndexWindow,
  rebalance: Rebalance = "daily",
): Backtest {
  const nAssets = market.tickers.length;
  const len = windowLength(window);
  const returns = new Float64Array(len);
  const wealth = new Float64Array(len);
  const drawdown = new Float64Array(len);
  const contributions = new Float64Array(nAssets);

  const active: number[] = [];
  let invested = 0;
  for (let i = 0; i < nAssets; i++) {
    const w = weights[i] ?? 0;
    if (w !== 0) {
      active.push(i);
      invested += w;
    }
  }
  const cashWeight = 1 - invested;

  let value = 1;
  let peak = 1;

  if (rebalance === "daily") {
    for (let k = 0; k < len; k++) {
      const t = window.startIdx + k;
      let r = 0;
      for (const i of active) {
        const x = market.returns[i][t];
        if (x === x) {
          const c = weights[i] * x;
          r += c;
          contributions[i] += value * c;
        }
      }
      value *= 1 + r;
      if (value > peak) peak = value;
      returns[k] = r;
      wealth[k] = value;
      drawdown[k] = value / peak - 1;
    }
  } else {
    const holdings = new Float64Array(nAssets);
    for (const i of active) holdings[i] = weights[i];
    let cash = cashWeight;
    let prevKey = len > 0 ? periodKey(market.dates[window.startIdx], rebalance) : "";
    for (let k = 0; k < len; k++) {
      const t = window.startIdx + k;
      if (rebalance !== "none") {
        const key = periodKey(market.dates[t], rebalance);
        if (k > 0 && key !== prevKey) {
          for (const i of active) holdings[i] = weights[i] * value;
          cash = cashWeight * value;
        }
        prevKey = key;
      }
      let next = cash;
      for (const i of active) {
        const x = market.returns[i][t];
        if (x === x) {
          contributions[i] += holdings[i] * x;
          holdings[i] *= 1 + x;
        }
        next += holdings[i];
      }
      returns[k] = next / value - 1;
      value = next;
      if (value > peak) peak = value;
      wealth[k] = value;
      drawdown[k] = value / peak - 1;
    }
  }

  return {
    dates: market.dates.slice(window.startIdx, window.startIdx + len),
    returns,
    wealth,
    drawdown,
    contributions,
    cashWeight,
  };
}

/** Cumulative return of one asset over the window, EXP(SUM(LN(1+r)))-1 with blanks as 0%. */
export function assetCumulativeReturn(series: Float64Array, window: IndexWindow): number {
  let logSum = 0;
  for (let t = window.startIdx; t <= window.endIdx; t++) {
    const x = series[t];
    if (x === x) logSum += Math.log1p(x);
  }
  return Math.expm1(logSum);
}
