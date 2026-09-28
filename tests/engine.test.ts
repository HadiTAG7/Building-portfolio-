import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assetCumulativeReturn, runBacktest } from "@/lib/finance/backtest";
import { DEFAULT_CONSTRAINTS, evaluateConstraints } from "@/lib/finance/constraints";
import { calendarYearReturns, computeMetrics, monthlyReturns, rollingReturns } from "@/lib/finance/metrics";
import {
  efficientFrontier,
  estimateInputs,
  maxSharpe,
  minVariance,
  portfolioReturn,
  portfolioVolatility,
  roundWeights,
  scenarioEstimate,
  type OptimizerConstraints,
} from "@/lib/finance/optimizer";
import { assetReliability, portfolioReliability } from "@/lib/finance/reliability";
import { correlationMatrix, covarianceFromCorrelation } from "@/lib/finance/stats";
import { resolveWindow } from "@/lib/finance/window";
import { presetWeights, toMarketData, UNIVERSE, type ReturnsPayload } from "@/lib/universe";

type Metrics = Record<string, number | null>;
interface Fixture {
  tickers: string[];
  windows: Record<"ultraGrowth" | "growth", { start: string | null; end: string | null }[]>;
  portfolios: { id: string; group: "ultraGrowth" | "growth"; metrics: Metrics[] }[];
  correlation: number[][];
  drawdowns: { id: string; maxDrawdown: number; troughDate: string }[];
  calendarYears: { id: string; years: Record<string, number> }[];
  efficientFrontier: Record<
    "constrained" | "longOnly",
    {
      tickers: string[];
      mu: number[];
      sigma: number[];
      cov: number[][];
      points: { label: string; weights: number[]; ret: number; vol: number; sharpe: number }[];
    }
  >;
  scenario: {
    tickers: string[];
    classes: string[];
    weights: number[];
    mu: (number | null)[];
    sigma: number[];
    corr: number[][];
    expected: { ret: number; vol: number; sharpe: number };
    checks: Record<"total" | "maxSingle" | "maxClass" | "core" | "synthetic", number>;
  };
  reliability: { ticker: string; actualDays: number; backcastDays: number; actualShare: number; rating: string }[];
}

const root = join(__dirname, "..");
const fixture: Fixture = JSON.parse(readFileSync(join(root, "tests/fixtures/excel-recalc.json"), "utf8"));
const payload: ReturnsPayload = JSON.parse(readFileSync(join(root, "public", UNIVERSE.source.returnsFile), "utf8"));
const market = toMarketData(payload);
const full = resolveWindow(market.dates);
const preset = (id: string) => presetWeights(UNIVERSE.presets.find((p) => p.id === id)!);
// The fixture covers the whole workbook; only presets and funds still in the tool are checked here.
const hasPreset = (id: string) => UNIVERSE.presets.some((p) => p.id === id);
const inTool = (ticker: string) => market.tickers.includes(ticker);

function close(actual: number | null, expected: number | null, rel = 1e-7, abs = 1e-9) {
  if (expected === null) {
    expect(actual).toBeNull();
    return;
  }
  expect(actual).not.toBeNull();
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(Math.max(abs, rel * Math.abs(expected)));
}

describe("portfolio comparison metrics match the recalculated workbook", () => {
  for (const p of fixture.portfolios.filter((x) => hasPreset(x.id))) {
    fixture.windows[p.group].forEach((win, w) => {
      it(`${p.id} window ${w} (${win.start ?? "start"} → ${win.end ?? "end"})`, () => {
        const m = computeMetrics(runBacktest(market, preset(p.id), resolveWindow(market.dates, win)));
        const x = p.metrics[w];
        expect(m.days).toBe(x.days);
        close(m.cumulative, x.cumulative);
        close(m.cagr, x.cagr);
        close(m.avgDaily, x.avgDaily);
        close(m.volatility, x.volatility);
        close(m.sharpe, x.sharpe);
        close(m.sortino, x.sortino);
        close(m.bestDay, x.bestDay);
        close(m.worstDay, x.worstDay);
        close(m.maxDrawdown, x.maxDrawdown);
        close(m.downsideDeviation, x.downsideDeviation);
      });
    });
  }
});

describe("risk dashboard", () => {
  it("correlation matrix (full history)", () => {
    const rows = fixture.tickers.map((t, k) => ({ k, i: market.tickers.indexOf(t) })).filter((x) => x.i >= 0);
    expect(rows.length).toBe(market.tickers.length);
    const corr = correlationMatrix(market, rows.map((r) => r.i), full);
    rows.forEach((a, r) => rows.forEach((b, c) => close(corr[r][c], fixture.correlation[a.k][b.k], 0, 1e-8)));
  });

  it("drawdown depth and trough date", () => {
    for (const d of fixture.drawdowns.filter((x) => hasPreset(x.id))) {
      const m = computeMetrics(runBacktest(market, preset(d.id), full));
      close(m.maxDrawdown, d.maxDrawdown);
      expect(m.troughDate).toBe(d.troughDate);
    }
  });

  it("calendar-year returns 2016–2025", () => {
    for (const c of fixture.calendarYears.filter((x) => hasPreset(x.id))) {
      const years = calendarYearReturns(runBacktest(market, preset(c.id), full));
      for (const [year, value] of Object.entries(c.years)) {
        const y = years.find((r) => r.year === Number(year));
        close(y?.ret ?? null, value);
        expect(y?.partial).toBe(false);
      }
      expect(years.at(-1)?.partial).toBe(true); // data ends in September 2026
    }
  });

  it("rolling 1-year windows equal brute-force products", () => {
    const bt = runBacktest(market, preset("ug-1"), full);
    const roll = rollingReturns(bt, 252);
    expect(roll.returns.length).toBe(bt.returns.length - 251);
    for (const j of [0, 1, 500, roll.returns.length - 1]) {
      let g = 1;
      for (let k = j; k < j + 252; k++) g *= 1 + bt.returns[k];
      close(roll.returns[j], g - 1, 1e-12, 1e-12);
    }
  });
});

describe("attribution and rebalancing", () => {
  it("asset contributions add up to the cumulative return", () => {
    for (const rebalance of ["daily", "monthly", "quarterly", "annually", "none"] as const) {
      const bt = runBacktest(market, preset("g-1"), resolveWindow(market.dates, { start: "2023-01-01" }), rebalance);
      const total = bt.contributions.reduce((a, b) => a + b, 0);
      close(total, bt.wealth[bt.wealth.length - 1] - 1, 1e-12, 1e-12);
    }
  });

  it("buy-and-hold of a single asset equals its own cumulative return", () => {
    const i = market.tickers.indexOf("GLD");
    const w = market.tickers.map((_, k) => (k === i ? 1 : 0));
    const win = resolveWindow(market.dates, { start: "2020-01-01", end: "2024-12-31" });
    const bt = runBacktest(market, w, win, "none");
    close(bt.wealth[bt.wealth.length - 1] - 1, assetCumulativeReturn(market.returns[i], win), 1e-12, 1e-12);
  });

  it("unallocated weight stays in cash at 0%", () => {
    const w = preset("g-6"); // the workbook's Growth P6 sums to 95%
    const bt = runBacktest(market, w, full);
    close(bt.cashWeight, 0.05, 1e-12, 1e-12);
  });

  it("monthly returns chain to the full-period return", () => {
    const bt = runBacktest(market, preset("g-2"), full);
    const chained = monthlyReturns(bt).reduce((g, m) => g * (1 + m.ret), 1) - 1;
    close(chained, bt.wealth[bt.wealth.length - 1] - 1, 1e-10, 1e-10);
  });
});

describe("reliability", () => {
  it("per-asset actual vs back-cast days", () => {
    for (const r of fixture.reliability.filter((x) => inTool(x.ticker))) {
      const meta = UNIVERSE.assets.find((a) => a.ticker === r.ticker)!;
      const out = assetReliability(market.dates, full, meta.inception);
      expect(out.actualDays).toBe(r.actualDays);
      expect(out.backcastDays).toBe(r.backcastDays);
      close(out.actualShare, r.actualShare, 1e-12, 1e-12);
      expect(out.rating).toBe(r.rating.toLowerCase());
    }
  });

  it("portfolio actual-only check picks the latest inception", () => {
    const inceptions = market.tickers.map((t) => UNIVERSE.assets.find((a) => a.ticker === t)!.inception);
    const r = portfolioReliability(market, preset("ug-1"), full, inceptions);
    expect(r.commonActualStart).toBe("2024-01-11"); // IBIT
    expect(r.verdict).toBe("reliable");
    expect(r.actualCagr).not.toBeNull();
  });
});

describe("efficient frontier formulas", () => {
  for (const key of ["constrained", "longOnly"] as const) {
    it(`${key}: portfolio return, volatility and Sharpe`, () => {
      const ef = fixture.efficientFrontier[key];
      for (const p of ef.points) {
        close(portfolioReturn(p.weights, ef.mu), p.ret, 1e-12, 1e-13);
        close(portfolioVolatility(p.weights, ef.cov), p.vol, 1e-12, 1e-13);
        close(portfolioReturn(p.weights, ef.mu) / portfolioVolatility(p.weights, ef.cov), p.sharpe, 1e-12, 1e-12);
      }
    });

    it(`${key}: covariance = ρ σ σ from the correlation grid`, () => {
      const ef = fixture.efficientFrontier[key];
      const idx = ef.tickers.map((t) => fixture.tickers.indexOf(t));
      const corr = idx.map((i) => idx.map((j) => fixture.correlation[i][j]));
      const cov = covarianceFromCorrelation(corr, ef.sigma);
      for (let i = 0; i < idx.length; i++) for (let j = 0; j < idx.length; j++) close(cov[i][j], ef.cov[i][j], 1e-12, 1e-14);
    });
  }

  it("long-only optimiser matches or beats the workbook's SLSQP output", () => {
    const ef = fixture.efficientFrontier.longOnly;
    const n = ef.mu.length;
    const cons: OptimizerConstraints = { lower: new Array(n).fill(0), upper: new Array(n).fill(1) };
    const tangency = maxSharpe(ef.mu, ef.cov, cons)!;
    const excelMax = ef.points.find((p) => p.label === "Max Sharpe")!;
    expect(tangency.sharpe!).toBeGreaterThanOrEqual(excelMax.sharpe - 1e-6);
    expect(tangency.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    const gmv = minVariance(ef.mu, ef.cov, cons)!;
    const excelGmv = ef.points.find((p) => p.label === "GMV")!;
    expect(gmv.vol).toBeLessThanOrEqual(excelGmv.vol + 1e-6);
    const frontier = efficientFrontier(ef.mu, ef.cov, cons, 0, 25);
    expect(frontier.points.length).toBe(25);
    for (let k = 1; k < frontier.points.length; k++) {
      expect(frontier.points[k].ret).toBeGreaterThan(frontier.points[k - 1].ret);
      expect(frontier.points[k].vol).toBeGreaterThanOrEqual(frontier.points[k - 1].vol - 1e-9);
    }
  });

  it("constrained optimiser respects the workbook's bounds", () => {
    const ef = fixture.efficientFrontier.constrained; // SPTE HLAL SPWO IBIT SOXX PAVE SPUS
    const cons: OptimizerConstraints = {
      lower: [0.2, 0, 0.1, 0.05, 0.05, 0.05, 0],
      upper: [0.4, 1, 1, 0.1, 0.15, 1, 1],
      groups: [{ members: [1, 6], min: 0.2 }],
    };
    const best = maxSharpe(ef.mu, ef.cov, cons)!;
    const excelMax = ef.points.find((p) => p.label.startsWith("Max Sharpe"))!;
    expect(best.sharpe!).toBeGreaterThanOrEqual(excelMax.sharpe - 1e-9);
    best.weights.forEach((w, i) => {
      expect(w).toBeGreaterThanOrEqual(cons.lower[i] - 1e-9);
      expect(w).toBeLessThanOrEqual(cons.upper[i] + 1e-9);
    });
    expect(best.weights[1] + best.weights[6]).toBeGreaterThanOrEqual(0.2 - 1e-9);
    const rounded = roundWeights(best.weights);
    expect(rounded.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    rounded.forEach((w) => expect(Math.round(w * 100)).toBeCloseTo(w * 100, 9));
  });

  it("estimates inputs from the daily data", () => {
    const idx = ["SPTE", "HLAL", "GLD"].map((t) => market.tickers.indexOf(t));
    const inceptions = market.tickers.map((t) => UNIVERSE.assets.find((a) => a.ticker === t)!.inception);
    const toMid2024 = resolveWindow(market.dates, { end: "2024-06-30" });
    const byWindow = estimateInputs(market, idx, toMid2024, "window", inceptions);
    expect(byWindow.assets).toEqual(idx);
    // SPTE launched in December 2023, so it has under a year of real history by mid-2024.
    const actualOnly = estimateInputs(market, idx, toMid2024, "actual", inceptions);
    expect(actualOnly.excluded).toEqual([market.tickers.indexOf("SPTE")]);
  });
});

describe("scenario sheet", () => {
  it("weighted-CAGR return, correlation-based volatility and Sharpe", () => {
    const s = fixture.scenario;
    const est = scenarioEstimate(s.weights, s.mu, s.sigma, s.corr);
    close(est.expectedReturn, s.expected.ret, 1e-12, 1e-13);
    close(est.volatility, s.expected.vol, 1e-12, 1e-13);
    close(est.sharpe, s.expected.sharpe, 1e-12, 1e-12);
    expect(est.missingReturn).toBe(false);
  });

  it("constraint checks", () => {
    const s = fixture.scenario;
    const results = evaluateConstraints(DEFAULT_CONSTRAINTS, s.tickers, s.classes, s.weights);
    const byId = Object.fromEntries(results.map((r) => [r.rule.id, r]));
    close(byId.total.value, s.checks.total, 1e-12, 1e-12);
    close(byId.maxSingle.value, s.checks.maxSingle, 1e-12, 1e-12);
    close(byId.maxClass.value, s.checks.maxClass, 1e-12, 1e-12);
    close(byId.core.value, s.checks.core, 1e-12, 1e-12);
    close(byId.synthetic.value, s.checks.synthetic, 1e-12, 1e-12);
    expect(results.every((r) => r.pass)).toBe(true);
  });
});
