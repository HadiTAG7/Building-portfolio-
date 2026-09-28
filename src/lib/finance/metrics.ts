import type { Backtest } from "./backtest";
import { PERIODS_PER_YEAR } from "./types";

export interface PerformanceMetrics {
  /** Trading days in the window (the workbook's COUNT / SUMPRODUCT of the date switch). */
  days: number;
  cumulative: number;
  /** (1 + cumulative)^(252 / days) - 1. */
  cagr: number | null;
  avgDaily: number | null;
  /** Sample standard deviation of daily returns x sqrt(252). */
  volatility: number | null;
  /** (CAGR - rf) / volatility; null when volatility is 0 (the workbook shows ""). */
  sharpe: number | null;
  /** (CAGR - rf) / downside deviation. */
  sortino: number | null;
  /** sqrt(SUM(r^2 for r < 0) / days) x sqrt(252). */
  downsideDeviation: number | null;
  bestDay: number | null;
  bestDayDate: string | null;
  worstDay: number | null;
  worstDayDate: string | null;
  maxDrawdown: number;
  peakDate: string | null;
  troughDate: string | null;
  /** First day after the trough on which the previous peak is regained; null if never. */
  recoveryDate: string | null;
  currentDrawdown: number;
  /** The workbook's "Recovered?" flag: current drawdown within 0.5% of the peak. */
  nearHigh: boolean;
  finalWealth: number;
  /** CAGR is annualised from less than one year of data. */
  shortWindow: boolean;
}

export function computeMetrics(bt: Backtest, riskFree = 0): PerformanceMetrics {
  const n = bt.returns.length;
  const finalWealth = n > 0 ? bt.wealth[n - 1] : 1;
  const cumulative = finalWealth - 1;

  let sum = 0;
  let downsideSq = 0;
  let best = -Infinity;
  let worst = Infinity;
  let bestIdx = -1;
  let worstIdx = -1;
  for (let k = 0; k < n; k++) {
    const r = bt.returns[k];
    sum += r;
    if (r < 0) downsideSq += r * r;
    if (r > best) {
      best = r;
      bestIdx = k;
    }
    if (r < worst) {
      worst = r;
      worstIdx = k;
    }
  }
  const mean = n > 0 ? sum / n : null;

  let volatility: number | null = null;
  if (n > 1 && mean !== null) {
    let sq = 0;
    for (let k = 0; k < n; k++) {
      const d = bt.returns[k] - mean;
      sq += d * d;
    }
    volatility = Math.sqrt(sq / (n - 1)) * Math.sqrt(PERIODS_PER_YEAR);
  }

  const cagr = n > 0 ? Math.pow(finalWealth, PERIODS_PER_YEAR / n) - 1 : null;
  const downsideDeviation = n > 0 ? Math.sqrt(downsideSq / n) * Math.sqrt(PERIODS_PER_YEAR) : null;
  const sharpe = cagr !== null && volatility ? (cagr - riskFree) / volatility : null;
  const sortino = cagr !== null && downsideDeviation ? (cagr - riskFree) / downsideDeviation : null;

  let maxDrawdown = 0;
  let troughIdx = -1;
  for (let k = 0; k < n; k++) {
    if (bt.drawdown[k] < maxDrawdown) {
      maxDrawdown = bt.drawdown[k];
      troughIdx = k;
    }
  }
  let peakDate: string | null = null;
  let recoveryDate: string | null = null;
  if (troughIdx >= 0) {
    let peakIdx = -1;
    let peakValue = 1;
    for (let k = 0; k < troughIdx; k++) {
      if (bt.wealth[k] >= peakValue) {
        peakValue = bt.wealth[k];
        peakIdx = k;
      }
    }
    peakDate = peakIdx >= 0 ? bt.dates[peakIdx] : bt.dates[0];
    for (let k = troughIdx + 1; k < n; k++) {
      if (bt.wealth[k] >= peakValue) {
        recoveryDate = bt.dates[k];
        break;
      }
    }
  }
  const currentDrawdown = n > 0 ? bt.drawdown[n - 1] : 0;

  return {
    days: n,
    cumulative,
    cagr,
    avgDaily: mean,
    volatility,
    sharpe,
    sortino,
    downsideDeviation,
    bestDay: bestIdx >= 0 ? best : null,
    bestDayDate: bestIdx >= 0 ? bt.dates[bestIdx] : null,
    worstDay: worstIdx >= 0 ? worst : null,
    worstDayDate: worstIdx >= 0 ? bt.dates[worstIdx] : null,
    maxDrawdown,
    peakDate,
    troughDate: troughIdx >= 0 ? bt.dates[troughIdx] : null,
    recoveryDate,
    currentDrawdown,
    nearHigh: currentDrawdown >= -0.005,
    finalWealth,
    shortWindow: n < PERIODS_PER_YEAR,
  };
}

export interface PeriodReturn {
  key: string;
  year: number;
  /** 1-12 for monthly returns, 0 for calendar years. */
  month: number;
  ret: number;
  days: number;
  /** The period is cut by the window start or end. */
  partial: boolean;
}

function periodReturns(bt: Backtest, keyLength: 4 | 7): PeriodReturn[] {
  const out: PeriodReturn[] = [];
  let current: PeriodReturn | null = null;
  let growth = 1;
  let firstDate = "";
  let lastDate = "";
  const close = () => {
    if (!current) return;
    current.ret = growth - 1;
    // Trading periods open within the first week and close in the last week of the
    // month/year; anything narrower was cut by the window or by the end of the data.
    const open = keyLength === 4 ? firstDate.slice(5) : firstDate.slice(8);
    const end = keyLength === 4 ? lastDate.slice(5) : lastDate.slice(8);
    current.partial = keyLength === 4 ? open > "01-07" || end < "12-24" : open > "07" || end < "24";
  };
  for (let k = 0; k < bt.returns.length; k++) {
    const key = bt.dates[k].slice(0, keyLength);
    if (!current || current.key !== key) {
      close();
      current = {
        key,
        year: Number(key.slice(0, 4)),
        month: keyLength === 7 ? Number(key.slice(5, 7)) : 0,
        ret: 0,
        days: 0,
        partial: false,
      };
      out.push(current);
      growth = 1;
      firstDate = bt.dates[k];
    }
    growth *= 1 + bt.returns[k];
    lastDate = bt.dates[k];
    current.days++;
  }
  close();
  return out;
}

/** PRODUCT(IF(YEAR(date)=y, 1+r, 1)) - 1 for each calendar year in the window. */
export function calendarYearReturns(bt: Backtest): PeriodReturn[] {
  return periodReturns(bt, 4);
}

export function monthlyReturns(bt: Backtest): PeriodReturn[] {
  return periodReturns(bt, 7);
}

export interface RollingSummary {
  windowDays: number;
  dates: string[];
  returns: Float64Array;
  best: number | null;
  worst: number | null;
  average: number | null;
  /** Share of windows with a positive return. */
  positiveShare: number | null;
}

/**
 * Every run of `windowDays` consecutive daily returns (wealth[t] / wealth[t - windowDays] - 1),
 * the Risk Dashboard's "Rolling 1-year (252 trading-day) return windows".
 */
export function rollingReturns(bt: Backtest, windowDays = PERIODS_PER_YEAR): RollingSummary {
  const n = bt.wealth.length;
  const count = Math.max(0, n - windowDays + 1);
  const returns = new Float64Array(count);
  const dates: string[] = new Array(count);
  let best = -Infinity;
  let worst = Infinity;
  let sum = 0;
  let positive = 0;
  for (let j = 0; j < count; j++) {
    const end = j + windowDays - 1;
    const base = j === 0 ? 1 : bt.wealth[j - 1];
    const r = bt.wealth[end] / base - 1;
    returns[j] = r;
    dates[j] = bt.dates[end];
    if (r > best) best = r;
    if (r < worst) worst = r;
    sum += r;
    if (r > 0) positive++;
  }
  return {
    windowDays,
    dates,
    returns,
    best: count ? best : null,
    worst: count ? worst : null,
    average: count ? sum / count : null,
    positiveShare: count ? positive / count : null,
  };
}
