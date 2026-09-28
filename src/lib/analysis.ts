import { runBacktest, type Backtest } from "@/lib/finance/backtest";
import {
  calendarYearReturns,
  computeMetrics,
  monthlyReturns,
  rollingReturns,
  type PerformanceMetrics,
  type PeriodReturn,
  type RollingSummary,
} from "@/lib/finance/metrics";
import { portfolioReliability, type PortfolioReliability } from "@/lib/finance/reliability";
import type { DateWindow, IndexWindow, MarketData, Rebalance } from "@/lib/finance/types";
import { resolveWindow, windowLength } from "@/lib/finance/window";
import type { PeriodPreset, PortfolioDraft, Settings } from "@/lib/store";
import { weightVector } from "@/lib/store";
import { UNIVERSE } from "@/lib/universe";

export const INCEPTIONS = UNIVERSE.assets.map((a) => a.inception);

function shiftYears(iso: string, years: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Date bounds for a period preset; relative presets count back from the last day of data. */
export function periodWindow(preset: PeriodPreset, settings: Pick<Settings, "customStart" | "customEnd">, lastDate: string): DateWindow {
  switch (preset) {
    case "full":
      return {};
    case "y2021_2025":
      return { start: "2021-01-01", end: "2025-12-31" };
    case "since2022":
      return { start: "2022-01-01" };
    case "since2023":
      return { start: "2023-01-01" };
    case "y2020_2025":
      return { start: "2020-01-01", end: "2025-12-31" };
    case "last3y":
      return { start: shiftYears(lastDate, 3) };
    case "last1y":
      return { start: shiftYears(lastDate, 1) };
    case "ytd":
      return { start: `${lastDate.slice(0, 4)}-01-01` };
    case "custom":
      return { start: settings.customStart, end: settings.customEnd };
  }
}

export interface PortfolioAnalysis {
  draft: PortfolioDraft;
  weights: number[];
  invested: number;
  backtest: Backtest;
  metrics: PerformanceMetrics;
  calendar: PeriodReturn[];
  monthly: PeriodReturn[];
  rolling: RollingSummary;
  reliability: PortfolioReliability;
}

export function analysePortfolio(
  market: MarketData,
  draft: PortfolioDraft,
  window: IndexWindow,
  rebalance: Rebalance,
  riskFree: number,
): PortfolioAnalysis {
  const weights = weightVector(draft);
  const backtest = runBacktest(market, weights, window, rebalance);
  return {
    draft,
    weights,
    invested: weights.reduce((a, b) => a + b, 0),
    backtest,
    metrics: computeMetrics(backtest, riskFree),
    calendar: calendarYearReturns(backtest),
    monthly: monthlyReturns(backtest),
    rolling: rollingReturns(backtest),
    reliability: portfolioReliability(market, weights, window, INCEPTIONS, rebalance),
  };
}

export function resolveAnalysisWindow(market: MarketData, settings: Settings): IndexWindow {
  const lastDate = market.dates[market.dates.length - 1];
  const win = resolveWindow(market.dates, periodWindow(settings.period, settings, lastDate));
  return windowLength(win) >= 2 ? win : resolveWindow(market.dates);
}

/** Every `step`-th point plus the last one, so long daily series stay light to draw. */
export function sampleIndices(length: number, maxPoints = 650): number[] {
  if (length <= maxPoints) return Array.from({ length }, (_, i) => i);
  const step = Math.ceil(length / maxPoints);
  const out: number[] = [];
  for (let i = 0; i < length; i += step) out.push(i);
  if (out[out.length - 1] !== length - 1) out.push(length - 1);
  return out;
}
