import type { PeriodPreset, Settings, SharedPortfolio } from "@/lib/store";
import { TICKERS } from "@/lib/universe";

interface SharePayload {
  v: 1;
  p: { n: string | null; id?: string; w: Record<string, number> }[];
  s?: Partial<Pick<Settings, "period" | "customStart" | "customEnd" | "rebalance" | "riskFree" | "amount">>;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeShare(portfolios: SharedPortfolio[], settings: Settings): string {
  const payload: SharePayload = {
    v: 1,
    p: portfolios.map((p) => ({ n: p.name, id: p.presetId, w: p.weights })),
    s: {
      period: settings.period,
      customStart: settings.customStart,
      customEnd: settings.customEnd,
      rebalance: settings.rebalance,
      riskFree: settings.riskFree,
      amount: settings.amount,
    },
  };
  return toBase64Url(JSON.stringify(payload));
}

const PERIODS: PeriodPreset[] = ["full", "y2021_2025", "since2022", "since2023", "y2020_2025", "last3y", "last1y", "ytd", "custom"];
const REBALANCE = ["daily", "monthly", "quarterly", "annually", "none"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Parse and validate a share token; anything unexpected is dropped rather than trusted. */
export function decodeShare(token: string): { portfolios: SharedPortfolio[]; settings: Partial<Settings> } | null {
  try {
    const raw = JSON.parse(fromBase64Url(token)) as Partial<SharePayload>;
    if (raw?.v !== 1 || !Array.isArray(raw.p)) return null;
    const portfolios: SharedPortfolio[] = raw.p.slice(0, 8).map((p) => {
      const weights: Record<string, number> = {};
      for (const t of TICKERS) {
        const v = p?.w?.[t];
        if (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 100) weights[t] = v;
      }
      return {
        name: typeof p?.n === "string" ? p.n.slice(0, 60) : null,
        presetId: typeof p?.id === "string" ? p.id.slice(0, 12) : undefined,
        weights,
      };
    });
    const s = raw.s ?? {};
    const settings: Partial<Settings> = {};
    if (s.period && PERIODS.includes(s.period)) settings.period = s.period;
    if (typeof s.customStart === "string" && ISO.test(s.customStart)) settings.customStart = s.customStart;
    if (typeof s.customEnd === "string" && ISO.test(s.customEnd)) settings.customEnd = s.customEnd;
    if (s.rebalance && REBALANCE.includes(s.rebalance)) settings.rebalance = s.rebalance;
    if (typeof s.riskFree === "number" && Number.isFinite(s.riskFree) && Math.abs(s.riskFree) <= 50) settings.riskFree = s.riskFree;
    if (typeof s.amount === "number" && Number.isFinite(s.amount) && s.amount > 0 && s.amount <= 1e12) settings.amount = s.amount;
    return portfolios.length ? { portfolios, settings } : null;
  } catch {
    return null;
  }
}
