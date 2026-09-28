import universeJson from "@/data/generated/universe.json";
import type { MarketData } from "@/lib/finance/types";

export interface AssetMethodology {
  classAr: string | null;
  statusAr: string | null;
  periodAr: string | null;
  proxyAr: string | null;
  correlation: number | null;
  qualityAr: string | null;
}

export interface AssetMeta {
  ticker: string;
  name: string;
  classEn: string;
  classAr: string | null;
  /** First date of real fund history in the window (the Summary / Reliability "First actual"). */
  inception: string | null;
  /** Last day styled as a back-cast estimate in the workbook, if any. */
  backcastUntil: string | null;
  /** First day with any return (later than the window start only when the workbook leaves blanks). */
  dataFrom: string | null;
  summaryNote: string | null;
  methodology: AssetMethodology | null;
  shariahNote: string | null;
}

export type PresetGroup = "ultraGrowth" | "growth";

export interface PresetPortfolio {
  id: string;
  group: PresetGroup;
  index: number;
  weights: Record<string, number>;
}

export interface Universe {
  source: {
    file: string;
    importedAt: string;
    firstDate: string;
    lastDate: string;
    tradingDays: number;
    returnsFile: string;
    hash: string;
  };
  assets: AssetMeta[];
  presets: PresetPortfolio[];
}

export const UNIVERSE = universeJson as unknown as Universe;
export const TICKERS = UNIVERSE.assets.map((a) => a.ticker);

export interface ReturnsPayload {
  dates: string[];
  returns: Record<string, (number | null)[]>;
}

export function toMarketData(payload: ReturnsPayload, tickers: readonly string[] = TICKERS): MarketData {
  const n = payload.dates.length;
  const returns = tickers.map((t) => {
    const src = payload.returns[t];
    if (!src || src.length !== n) throw new Error(`Missing or misaligned returns for ${t}`);
    const out = new Float64Array(n);
    for (let k = 0; k < n; k++) out[k] = src[k] ?? NaN;
    return out;
  });
  return { dates: payload.dates, tickers: [...tickers], returns };
}

let pending: Promise<MarketData> | null = null;

/** Fetch the daily returns once per page load (the file name carries a content hash, so it caches forever). */
export function loadMarketData(): Promise<MarketData> {
  pending ??= fetch(UNIVERSE.source.returnsFile)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load market data (${res.status})`);
      return res.json() as Promise<ReturnsPayload>;
    })
    .then((payload) => toMarketData(payload))
    .catch((err) => {
      pending = null;
      throw err;
    });
  return pending;
}

export function presetWeights(preset: PresetPortfolio, tickers: readonly string[] = TICKERS): number[] {
  return tickers.map((t) => preset.weights[t] ?? 0);
}
