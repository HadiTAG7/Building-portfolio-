import type { IndexWindow, MarketData } from "./types";
import { PERIODS_PER_YEAR } from "./types";

export interface AssetStats {
  /** Days with data (blank cells are skipped, as Excel's STDEV/CORREL do). */
  days: number;
  cumulative: number;
  /** Annualised return; null with less than a year of data, like the Summary sheet's "—". */
  cagr: number | null;
  volatility: number | null;
  bestDay: number | null;
  worstDay: number | null;
}

export function assetStats(series: Float64Array, window: IndexWindow): AssetStats {
  let days = 0;
  let logSum = 0;
  let sum = 0;
  let best = -Infinity;
  let worst = Infinity;
  for (let t = window.startIdx; t <= window.endIdx; t++) {
    const x = series[t];
    if (x !== x) continue;
    days++;
    logSum += Math.log1p(x);
    sum += x;
    if (x > best) best = x;
    if (x < worst) worst = x;
  }
  let volatility: number | null = null;
  if (days > 1) {
    const mean = sum / days;
    let sq = 0;
    for (let t = window.startIdx; t <= window.endIdx; t++) {
      const x = series[t];
      if (x === x) sq += (x - mean) * (x - mean);
    }
    volatility = Math.sqrt(sq / (days - 1)) * Math.sqrt(PERIODS_PER_YEAR);
  }
  const growth = Math.exp(logSum);
  return {
    days,
    cumulative: growth - 1,
    cagr: days >= PERIODS_PER_YEAR ? Math.pow(growth, PERIODS_PER_YEAR / days) - 1 : null,
    volatility,
    bestDay: days ? best : null,
    worstDay: days ? worst : null,
  };
}

/** Pearson correlation over the days where both series have data (Excel CORREL). */
export function correlation(a: Float64Array, b: Float64Array, window: IndexWindow): number | null {
  let n = 0;
  let sa = 0;
  let sb = 0;
  for (let t = window.startIdx; t <= window.endIdx; t++) {
    const x = a[t];
    const y = b[t];
    if (x !== x || y !== y) continue;
    n++;
    sa += x;
    sb += y;
  }
  if (n < 2) return null;
  const ma = sa / n;
  const mb = sb / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let t = window.startIdx; t <= window.endIdx; t++) {
    const x = a[t];
    const y = b[t];
    if (x !== x || y !== y) continue;
    cov += (x - ma) * (y - mb);
    va += (x - ma) * (x - ma);
    vb += (y - mb) * (y - mb);
  }
  if (va === 0 || vb === 0) return null;
  return cov / Math.sqrt(va * vb);
}

/** Correlation matrix for the given asset indices (the Risk Dashboard's ρ grid). */
export function correlationMatrix(market: MarketData, assets: readonly number[], window: IndexWindow): number[][] {
  const m = assets.length;
  const out: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  for (let i = 0; i < m; i++) {
    out[i][i] = 1;
    for (let j = i + 1; j < m; j++) {
      const c = correlation(market.returns[assets[i]], market.returns[assets[j]], window) ?? 0;
      out[i][j] = c;
      out[j][i] = c;
    }
  }
  return out;
}

/** Σ_ij = ρ_ij σ_i σ_j, the covariance build used by both efficient-frontier sheets. */
export function covarianceFromCorrelation(corr: readonly (readonly number[])[], sigma: readonly number[]): number[][] {
  return corr.map((row, i) => row.map((rho, j) => rho * sigma[i] * sigma[j]));
}
