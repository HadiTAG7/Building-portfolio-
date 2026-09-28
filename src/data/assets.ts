/**
 * Editorial metadata that the workbook only has in one language or as free text.
 * Numbers and dates come from src/data/generated/universe.json (scripts/import_excel.py).
 *
 * Shariah status is conservative: "compliant" only where the fund's own mandate is
 * Shariah-screened (SP Funds, Wahed); everything else is left unscreened.
 */
export type Bucket = "equities" | "income" | "alternatives";
export type ShariahStatus = "compliant" | "nonCompliant" | "unscreened";
export type ShariahSource = "mandate" | "workbook" | "none";

export interface AssetInfo {
  bucket: Bucket;
  classAr: string;
  classEn: string;
  shariah: ShariahStatus;
  shariahSource: ShariahSource;
  /** Proxy used for the pre-inception back-cast, if any. */
  proxy?: { ar: string; en: string };
}

export const ASSET_INFO: Record<string, AssetInfo> = {
  SPTE: {
    bucket: "equities",
    classAr: "تقنية عالمية",
    classEn: "Global technology",
    shariah: "compliant",
    shariahSource: "mandate",
    proxy: { ar: "مؤشر IXN (تقنية عالمية)", en: "IXN (global technology)" },
  },
  HLAL: {
    bucket: "equities",
    classAr: "أسهم أمريكية (شرعي)",
    classEn: "US equities (Shariah)",
    shariah: "compliant",
    shariahSource: "mandate",
    proxy: { ar: "SPY (أسهم أمريكية)", en: "SPY (US equities)" },
  },
  SPUS: {
    bucket: "equities",
    classAr: "أسهم أمريكية (شرعي)",
    classEn: "US equities (Shariah)",
    shariah: "compliant",
    shariahSource: "mandate",
    proxy: { ar: "SPY (أسهم أمريكية)", en: "SPY (US equities)" },
  },
  KSA: {
    bucket: "equities",
    classAr: "أسهم سعودية",
    classEn: "Saudi equities",
    shariah: "unscreened",
    shariahSource: "none",
  },
  SPWO: {
    bucket: "equities",
    classAr: "أسهم عالمية (عدا أمريكا)",
    classEn: "World ex-US equities",
    shariah: "compliant",
    shariahSource: "mandate",
    proxy: { ar: "ACWX (عالمي عدا أمريكا)", en: "ACWX (world ex-US)" },
  },
  SPSK: {
    bucket: "income",
    classAr: "صكوك (دخل ثابت)",
    classEn: "Sukuk (fixed income)",
    shariah: "compliant",
    shariahSource: "mandate",
  },
  SPRE: {
    bucket: "income",
    classAr: "عقار (REIT عالمي)",
    classEn: "Global REITs",
    shariah: "compliant",
    shariahSource: "mandate",
    proxy: { ar: "REET (عقار عالمي)", en: "REET (global REITs)" },
  },
  GLD: {
    bucket: "alternatives",
    classAr: "ذهب",
    classEn: "Gold",
    shariah: "unscreened",
    shariahSource: "none",
  },
  SLV: {
    bucket: "alternatives",
    classAr: "فضة",
    classEn: "Silver",
    shariah: "unscreened",
    shariahSource: "none",
  },
  IBIT: {
    bucket: "alternatives",
    classAr: "بيتكوين",
    classEn: "Bitcoin",
    shariah: "unscreened",
    shariahSource: "none",
    proxy: { ar: "سعر البيتكوين الفوري (BTC-USD)", en: "BTC-USD spot price" },
  },
};

export const BUCKET_ORDER: Bucket[] = ["equities", "income", "alternatives"];

const FALLBACK: AssetInfo = {
  bucket: "equities",
  classAr: "أخرى",
  classEn: "Other",
  shariah: "unscreened",
  shariahSource: "none",
};

export function assetInfo(ticker: string): AssetInfo {
  return ASSET_INFO[ticker] ?? FALLBACK;
}
