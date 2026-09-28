import { solveQP } from "quadprog";
import { assetStats, correlationMatrix, covarianceFromCorrelation } from "./stats";
import type { IndexWindow, MarketData } from "./types";
import { PERIODS_PER_YEAR } from "./types";
import { lowerBound } from "./window";

export interface GroupBound {
  members: number[];
  min?: number;
  max?: number;
}

/** Long-only bounds per asset (0..1) plus optional group bounds, all on the optimiser's asset order. */
export interface OptimizerConstraints {
  lower: number[];
  upper: number[];
  groups?: GroupBound[];
}

export interface FrontierPoint {
  weights: number[];
  ret: number;
  vol: number;
  sharpe: number | null;
}

export function portfolioReturn(weights: readonly number[], mu: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < weights.length; i++) s += weights[i] * mu[i];
  return s;
}

/** sqrt(wᵀ Σ w), the sheets' SQRT(MMULT(MMULT(w, Σ), TRANSPOSE(w))). */
export function portfolioVolatility(weights: readonly number[], cov: readonly (readonly number[])[]): number {
  let v = 0;
  for (let i = 0; i < weights.length; i++) {
    if (!weights[i]) continue;
    for (let j = 0; j < weights.length; j++) v += weights[i] * cov[i][j] * weights[j];
  }
  return Math.sqrt(Math.max(0, v));
}

function point(weights: number[], mu: readonly number[], cov: readonly (readonly number[])[], riskFree: number): FrontierPoint {
  const ret = portfolioReturn(weights, mu);
  const vol = portfolioVolatility(weights, cov);
  return { weights, ret, vol, sharpe: vol > 0 ? (ret - riskFree) / vol : null };
}

interface Row {
  a: number[];
  b: number;
}

/**
 * minimise ½ xᵀDx − dᵀx subject to a·x = b (first `meq` rows) and a·x ≥ b (the rest).
 * Wraps quadprog's 1-based interface; returns null when infeasible or not solvable.
 */
function solve(D: number[][], d: number[], rows: Row[], meq: number): number[] | null {
  const n = d.length;
  const Dmat: number[][] = [[]];
  const dvec: number[] = [0];
  const Amat: number[][] = [[]];
  for (let i = 1; i <= n; i++) {
    Dmat[i] = [0];
    Amat[i] = [0];
    dvec[i] = d[i - 1];
    for (let j = 1; j <= n; j++) Dmat[i][j] = D[i - 1][j - 1];
    for (let k = 1; k <= rows.length; k++) Amat[i][k] = rows[k - 1].a[i - 1];
  }
  const bvec = [0, ...rows.map((r) => r.b)];
  const res = solveQP(Dmat, dvec, Amat, bvec, meq);
  if (res.message || !res.solution) return null;
  const x = res.solution.slice(1, n + 1);
  return x.every(Number.isFinite) ? x : null;
}

function ridge(cov: readonly (readonly number[])[]): number[][] {
  const n = cov.length;
  let trace = 0;
  for (let i = 0; i < n; i++) trace += cov[i][i];
  const eps = Math.max(1e-12, (trace / Math.max(1, n)) * 1e-9);
  return cov.map((row, i) => row.map((v, j) => (i === j ? v + eps : v)));
}

function unit(n: number, i: number, value = 1): number[] {
  const a = new Array<number>(n).fill(0);
  a[i] = value;
  return a;
}

/** Budget, bound and group rows for weights x (length n). */
function weightRows(n: number, cons: OptimizerConstraints): { eq: Row[]; ineq: Row[] } {
  const eq: Row[] = [{ a: new Array<number>(n).fill(1), b: 1 }];
  const ineq: Row[] = [];
  for (let i = 0; i < n; i++) {
    ineq.push({ a: unit(n, i), b: cons.lower[i] ?? 0 });
    if ((cons.upper[i] ?? 1) < 1 - 1e-12) ineq.push({ a: unit(n, i, -1), b: -cons.upper[i] });
  }
  for (const g of cons.groups ?? []) {
    const a = new Array<number>(n).fill(0);
    for (const m of g.members) a[m] = 1;
    if (g.min !== undefined) ineq.push({ a, b: g.min });
    if (g.max !== undefined) ineq.push({ a: a.map((v) => -v), b: -g.max });
  }
  return { eq, ineq };
}

function clean(weights: number[]): number[] {
  const w = weights.map((v) => (Math.abs(v) < 1e-10 ? 0 : v));
  const s = w.reduce((a, b) => a + b, 0);
  return s > 0 ? w.map((v) => v / s) : w;
}

/** Global minimum-variance portfolio, or the minimum-variance portfolio at `targetReturn`. */
export function minVariance(
  mu: readonly number[],
  cov: readonly (readonly number[])[],
  cons: OptimizerConstraints,
  riskFree = 0,
  targetReturn?: number,
): FrontierPoint | null {
  const n = mu.length;
  const { eq, ineq } = weightRows(n, cons);
  if (targetReturn !== undefined) eq.push({ a: [...mu], b: targetReturn });
  const x = solve(ridge(cov), new Array<number>(n).fill(0), [...eq, ...ineq], eq.length);
  return x ? point(clean(x), mu, cov, riskFree) : null;
}

/** Highest-return feasible portfolio (an LP, solved as a lightly regularised QP). */
export function maxReturn(
  mu: readonly number[],
  cov: readonly (readonly number[])[],
  cons: OptimizerConstraints,
  riskFree = 0,
): FrontierPoint | null {
  const n = mu.length;
  const scale = Math.max(1e-9, ...mu.map(Math.abs)) * 1e-6;
  const D = Array.from({ length: n }, (_, i) => unit(n, i, scale));
  const { eq, ineq } = weightRows(n, cons);
  const x = solve(D, [...mu], [...eq, ...ineq], eq.length);
  return x ? point(clean(x), mu, cov, riskFree) : null;
}

/**
 * Tangency (maximum Sharpe) portfolio under the bounds, via the standard substitution
 * y = κw: minimise yᵀΣy s.t. (μ − rf)ᵀy = 1, Σy = κ, lᵢκ ≤ yᵢ ≤ uᵢκ, group bounds × κ.
 */
export function maxSharpe(
  mu: readonly number[],
  cov: readonly (readonly number[])[],
  cons: OptimizerConstraints,
  riskFree = 0,
): FrontierPoint | null {
  const n = mu.length;
  const m = n + 1;
  const base = ridge(cov);
  const D = Array.from({ length: m }, (_, i) =>
    Array.from({ length: m }, (_, j) => (i < n && j < n ? base[i][j] : i === j ? 1e-10 : 0)),
  );
  const rows: Row[] = [
    { a: [...mu.map((v) => v - riskFree), 0], b: 1 },
    { a: [...new Array<number>(n).fill(1), -1], b: 0 },
  ];
  for (let i = 0; i < n; i++) {
    const lo = unit(m, i);
    lo[n] = -(cons.lower[i] ?? 0);
    rows.push({ a: lo, b: 0 });
    if ((cons.upper[i] ?? 1) < 1 - 1e-12) {
      const up = unit(m, i, -1);
      up[n] = cons.upper[i];
      rows.push({ a: up, b: 0 });
    }
  }
  for (const g of cons.groups ?? []) {
    const a = new Array<number>(m).fill(0);
    for (const k of g.members) a[k] = 1;
    if (g.min !== undefined) rows.push({ a: [...a.slice(0, n), -g.min], b: 0 });
    if (g.max !== undefined) rows.push({ a: [...a.slice(0, n).map((v) => -v), g.max], b: 0 });
  }
  rows.push({ a: unit(m, n), b: 0 });
  const z = solve(D, new Array<number>(m).fill(0), rows, 2);
  if (!z || !(z[n] > 1e-12)) return null;
  return point(clean(z.slice(0, n).map((y) => y / z[n])), mu, cov, riskFree);
}

export interface Frontier {
  points: FrontierPoint[];
  minVariance: FrontierPoint | null;
  maxSharpe: FrontierPoint | null;
}

/** Minimum-variance portfolios for evenly spaced target returns between the GMV and the max-return portfolio. */
export function efficientFrontier(
  mu: readonly number[],
  cov: readonly (readonly number[])[],
  cons: OptimizerConstraints,
  riskFree = 0,
  count = 40,
): Frontier {
  const gmv = minVariance(mu, cov, cons, riskFree);
  const top = maxReturn(mu, cov, cons, riskFree);
  const points: FrontierPoint[] = [];
  if (gmv && top && top.ret > gmv.ret) {
    // The max-return corner is degenerate for the equality-constrained solve; stop a hair short of it.
    const span = (top.ret - gmv.ret) * (1 - 1e-7);
    for (let k = 0; k < count; k++) {
      const target = gmv.ret + (span * k) / (count - 1);
      const p = k === 0 ? gmv : (minVariance(mu, cov, cons, riskFree, target) ?? (k === count - 1 ? top : null));
      if (p) points.push(p);
    }
  } else if (gmv) {
    points.push(gmv);
  }
  let best = maxSharpe(mu, cov, cons, riskFree);
  for (const p of points) {
    if (p.sharpe !== null && (!best || best.sharpe === null || p.sharpe > best.sharpe + 1e-9)) best = p;
  }
  return { points, minVariance: gmv, maxSharpe: best };
}

/** Round to whole steps (default 1%) with the largest-remainder method, keeping Σw = 1. */
export function roundWeights(weights: readonly number[], step = 0.01): number[] {
  const units = Math.round(1 / step);
  const raw = weights.map((w) => Math.max(0, w) * units);
  const floor = raw.map(Math.floor);
  let missing = units - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, frac: v - floor[i] })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; missing > 0 && k < order.length; k++, missing--) floor[order[k].i] += 1;
  return floor.map((u) => u / units);
}

export type EstimationMode = "window" | "actual";

export interface OptimizerInputs {
  /** Market indices of the assets kept in the optimisation. */
  assets: number[];
  /** Market indices dropped for lack of a full year of data. */
  excluded: number[];
  mu: number[];
  sigma: number[];
  corr: number[][];
  cov: number[][];
}

/**
 * Expected returns and risk for the frontier, following the workbook's recipe:
 * μ = annualised return (CAGR), σ = annualised volatility, ρ = daily correlations, Σ = ρσσ.
 * `window` estimates everything over the analysis window (back-cast included);
 * `actual` measures μ and σ only on real fund history (the Summary sheet), keeping ρ from the window.
 */
export function estimateInputs(
  market: MarketData,
  assets: readonly number[],
  window: IndexWindow,
  mode: EstimationMode = "window",
  inceptions: readonly (string | null)[] = [],
): OptimizerInputs {
  const kept: number[] = [];
  const excluded: number[] = [];
  const mu: number[] = [];
  const sigma: number[] = [];
  for (const i of assets) {
    let w = window;
    if (mode === "actual" && inceptions[i]) {
      w = { startIdx: Math.max(window.startIdx, lowerBound(market.dates, inceptions[i]!)), endIdx: window.endIdx };
    }
    const s = assetStats(market.returns[i], w);
    if (s.days < PERIODS_PER_YEAR || s.cagr === null || !s.volatility) {
      excluded.push(i);
      continue;
    }
    kept.push(i);
    mu.push(s.cagr);
    sigma.push(s.volatility);
  }
  const corr = correlationMatrix(market, kept, window);
  return { assets: kept, excluded, mu, sigma, corr, cov: covarianceFromCorrelation(corr, sigma) };
}

export interface ScenarioEstimate {
  expectedReturn: number;
  volatility: number;
  sharpe: number | null;
  /** Some weighted asset has no return estimate, so the expected return is understated. */
  missingReturn: boolean;
}

/** The Scenario sheet's quick estimate: Σ wᵢμᵢ and sqrt((w∘σ)ᵀ ρ (w∘σ)). */
export function scenarioEstimate(
  weights: readonly number[],
  mu: readonly (number | null)[],
  sigma: readonly number[],
  corr: readonly (readonly number[])[],
  riskFree = 0,
): ScenarioEstimate {
  let expectedReturn = 0;
  let missingReturn = false;
  const scaled = weights.map((w, i) => w * sigma[i]);
  for (let i = 0; i < weights.length; i++) {
    if (mu[i] === null) {
      if (weights[i] > 0) missingReturn = true;
    } else {
      expectedReturn += weights[i] * (mu[i] as number);
    }
  }
  const volatility = portfolioVolatility(scaled, corr);
  return {
    expectedReturn,
    volatility,
    sharpe: volatility > 0 ? (expectedReturn - riskFree) / volatility : null,
    missingReturn,
  };
}
