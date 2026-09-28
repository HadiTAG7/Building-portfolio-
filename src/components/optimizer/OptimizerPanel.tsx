"use client";

import { useMemo, useState } from "react";
import { assetInfo } from "@/data/assets";
import { useI18n } from "@/i18n/I18nProvider";
import { INCEPTIONS } from "@/lib/analysis";
import {
  efficientFrontier,
  estimateInputs,
  portfolioReturn,
  portfolioVolatility,
  roundWeights,
  type EstimationMode,
  type FrontierPoint,
  type OptimizerConstraints,
} from "@/lib/finance/optimizer";
import { assetReliability } from "@/lib/finance/reliability";
import type { IndexWindow, MarketData } from "@/lib/finance/types";
import { portfolioLabel, seriesColor } from "@/lib/portfolio-label";
import { MAX_PORTFOLIOS, usePortfolioStore, weightVector } from "@/lib/store";
import { useUiStore } from "@/lib/ui-store";
import { NumberField } from "../workspace/WeightInput";
import { Badge, Button, Card, CardHeader, Segmented, Select, Switch } from "../ui";
import { FrontierChart, type ScatterPoint } from "./FrontierChart";

type Universe = "held" | "all" | "shariah";
type BoundsPreset = "none" | "cap" | "excel";

/** EF (Constrained) sheet: bounds on the Ultra Growth universe, everything else at 0%. */
const EXCEL_BOUNDS: Record<string, [number, number]> = {
  SPTE: [20, 40],
  HLAL: [0, 100],
  SPWO: [10, 100],
  IBIT: [5, 10],
  SOXX: [5, 15],
  PAVE: [5, 100],
  SPUS: [0, 100],
};

function boundsFor(tk: string, preset: BoundsPreset, cap: number, custom: Record<string, [number, number]>): [number, number] {
  if (custom[tk]) return custom[tk];
  if (preset === "excel") return EXCEL_BOUNDS[tk] ?? [0, 0];
  if (preset === "cap") return [0, cap];
  return [0, 100];
}

function WeightsList({ point, tickers, color }: { point: FrontierPoint; tickers: string[]; color: string }) {
  const { f } = useI18n();
  const rows = point.weights
    .map((w, i) => ({ t: tickers[i], w }))
    .filter((x) => x.w > 0.00005)
    .sort((a, b) => b.w - a.w);
  const max = Math.max(...rows.map((r) => r.w), 1e-9);
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.t} className="grid grid-cols-[52px_minmax(0,1fr)_56px] items-center gap-2" dir="ltr">
          <span className="text-[12.5px] font-extrabold text-ink">{r.t}</span>
          <span className="h-2 rounded-full bg-[#eef2f8]">
            <span className="block h-full rounded-r-[4px]" style={{ width: `${(r.w / max) * 100}%`, background: color }} />
          </span>
          <span className="tnum text-end text-[12.5px] font-extrabold text-ink">{f.pct(r.w, 1)}</span>
        </li>
      ))}
    </ul>
  );
}

export function OptimizerPanel({ market, range }: { market: MarketData; range: IndexWindow }) {
  const { t, f } = useI18n();
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activeId = usePortfolioStore((s) => s.activeId);
  const riskFree = usePortfolioStore((s) => s.settings.riskFree) / 100;
  const setWeights = usePortfolioStore((s) => s.setWeights);
  const addPortfolio = usePortfolioStore((s) => s.addPortfolio);
  const notify = useUiStore((s) => s.notify);

  const [universe, setUniverse] = useState<Universe>("held");
  const [mode, setMode] = useState<EstimationMode>("window");
  const [preset, setPreset] = useState<BoundsPreset>("none");
  const [cap, setCap] = useState(45);
  const [custom, setCustom] = useState<Record<string, [number, number]>>({});
  const [whole, setWhole] = useState(true);

  const active = portfolios.find((p) => p.id === activeId) ?? portfolios[0];

  const all = useMemo(
    () => estimateInputs(market, market.tickers.map((_, i) => i), range, mode, INCEPTIONS),
    [market, range, mode],
  );
  const posInAll = useMemo(() => new Map(all.assets.map((m, k) => [m, k])), [all]);

  const universeIdx = useMemo(() => {
    let idx: number[];
    if (preset === "excel") idx = Object.keys(EXCEL_BOUNDS).map((tk) => market.tickers.indexOf(tk));
    else if (universe === "all") idx = market.tickers.map((_, i) => i);
    else if (universe === "shariah") idx = market.tickers.map((tk, i) => (assetInfo(tk).shariah === "compliant" ? i : -1));
    else idx = weightVector(active).map((w, i) => (w > 0 ? i : -1));
    return idx.filter((i) => i >= 0);
  }, [preset, universe, market, active]);

  const kept = useMemo(() => universeIdx.filter((i) => posInAll.has(i)), [universeIdx, posInAll]);
  const excluded = universeIdx.filter((i) => !posInAll.has(i)).map((i) => market.tickers[i]);
  const tickers = useMemo(() => kept.map((i) => market.tickers[i]), [kept, market]);
  const bounds = (tk: string) => boundsFor(tk, preset, cap, custom);

  const result = useMemo(() => {
    if (kept.length < 2) return null;
    const pos = kept.map((i) => posInAll.get(i)!);
    const mu = pos.map((p) => all.mu[p]);
    const cov = pos.map((p) => pos.map((q) => all.cov[p][q]));
    const cons: OptimizerConstraints = {
      lower: tickers.map((tk) => boundsFor(tk, preset, cap, custom)[0] / 100),
      upper: tickers.map((tk) => boundsFor(tk, preset, cap, custom)[1] / 100),
      groups:
        preset === "excel"
          ? [{ members: ["HLAL", "SPUS"].map((tk) => tickers.indexOf(tk)).filter((k) => k >= 0), min: 0.2 }]
          : undefined,
    };
    const frontier = efficientFrontier(mu, cov, cons, riskFree, 40);
    const finish = (p: FrontierPoint | null): FrontierPoint | null => {
      if (!p || !whole) return p;
      const w = roundWeights(p.weights);
      const ret = portfolioReturn(w, mu);
      const vol = portfolioVolatility(w, cov);
      return { weights: w, ret, vol, sharpe: vol > 0 ? (ret - riskFree) / vol : null };
    };
    return { frontier, mu, cov, tangency: finish(frontier.maxSharpe), gmv: finish(frontier.minVariance) };
  }, [kept, tickers, all, posInAll, preset, cap, custom, whole, riskFree]);

  const assetPoints: ScatterPoint[] = kept.map((m) => {
    const k = posInAll.get(m)!;
    return {
      key: market.tickers[m],
      label: market.tickers[m],
      vol: all.sigma[k],
      ret: all.mu[k],
      sharpe: all.sigma[k] ? (all.mu[k] - riskFree) / all.sigma[k] : null,
      color: "#9aa3b5",
    };
  });

  const portfolioPoints: ScatterPoint[] = portfolios.flatMap((p) => {
    const w = weightVector(p);
    if (w.some((x, i) => x > 0 && !posInAll.has(i)) || !w.some((x) => x > 0)) return [];
    const wAll = all.assets.map((m) => w[m]);
    const ret = portfolioReturn(wAll, all.mu);
    const vol = portfolioVolatility(wAll, all.cov);
    return [{ key: p.id, label: portfolioLabel(p, t), vol, ret, sharpe: vol ? (ret - riskFree) / vol : null, color: seriesColor(p.slot) }];
  });

  // Weighted share of back-cast history behind a suggestion (DRAM/AIPO-heavy answers lean on estimates).
  const estimatedShare = (p: FrontierPoint) =>
    p.weights.reduce((acc, w, k) => acc + w * (1 - assetReliability(market.dates, range, INCEPTIONS[kept[k]]).actualShare), 0);

  const toPercent = (p: FrontierPoint) => Object.fromEntries(p.weights.map((w, i) => [tickers[i], Math.round(w * 1e6) / 1e4]).filter(([, w]) => (w as number) > 0));

  const apply = (p: FrontierPoint, kind: string, asNew: boolean) => {
    const weights = toPercent(p);
    if (asNew) addPortfolio({ name: t.optimizer.newName(kind), weights });
    else setWeights(active.id, weights);
    notify(t.optimizer.applied);
  };

  const infeasible = kept.length >= 2 && result && !result.frontier.points.length;

  return (
    <Card id="optimizer" className="p-5 sm:p-7">
      <CardHeader title={<span className="text-[22px] font-extrabold">{t.optimizer.title}</span>} subtitle={t.optimizer.subtitle} />

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-bold text-muted">{t.optimizer.universe}</span>
          <Segmented
            value={preset === "excel" ? "held" : universe}
            onChange={(v) => {
              setUniverse(v);
              if (preset === "excel") setPreset("none");
            }}
            options={[
              { value: "held", label: t.optimizer.universeHeld },
              { value: "shariah", label: t.optimizer.universeShariah },
              { value: "all", label: t.optimizer.universeAll },
            ]}
          />
        </div>
        <Select
          label={t.optimizer.estimation}
          value={mode}
          onChange={setMode}
          options={[
            { value: "window", label: t.optimizer.estimationWindow },
            { value: "actual", label: t.optimizer.estimationActual },
          ]}
        />
        <Select
          label={t.optimizer.boundsPreset}
          value={preset}
          onChange={(v) => {
            setPreset(v);
            setCustom({});
          }}
          options={[
            { value: "none", label: t.optimizer.boundsNone },
            { value: "cap", label: t.optimizer.boundsCap(f.pct(cap / 100, 0)) },
            { value: "excel", label: t.optimizer.boundsExcel },
          ]}
        />
        {preset === "cap" ? (
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-muted">{t.optimizer.max}</span>
            <NumberField value={cap} onCommit={(v) => v > 0 && setCap(v)} label={t.optimizer.max} min={1} />
          </div>
        ) : null}
        <div className="pb-2">
          <Switch checked={whole} onChange={setWhole} label={t.optimizer.wholePercent} />
        </div>
      </div>

      {excluded.length ? <p className="mt-3 text-[12.5px] font-bold text-warning-text">⚠ {t.optimizer.excluded(excluded.join(", "))}</p> : null}
      {preset === "excel" ? <p className="mt-2 text-[12.5px] font-bold text-muted">{t.optimizer.groupNote}</p> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          {kept.length < 2 ? (
            <div className="flex h-[420px] items-center justify-center rounded-2xl bg-[#f6f8fc] text-[14px] text-muted">{t.optimizer.tooFew}</div>
          ) : infeasible ? (
            <div className="flex h-[420px] items-center justify-center rounded-2xl bg-[#fdf3f3] px-6 text-center text-[14px] font-bold text-critical">{t.optimizer.infeasible}</div>
          ) : result ? (
            <>
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-bold text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-[3px] w-4 rounded-full bg-navy" />
                  {t.optimizer.frontier}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#9aa3b5]" />
                  {t.optimizer.assetsSeries}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[#eda100]">★</span>
                  {t.optimizer.maxSharpe}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-navy">◆</span>
                  {t.optimizer.minVol}
                </span>
              </div>
              <FrontierChart
                frontier={result.frontier.points.map((p) => ({ vol: p.vol, ret: p.ret }))}
                assets={assetPoints}
                portfolios={portfolioPoints}
                tangency={result.tangency ? { key: "tan", label: t.optimizer.maxSharpe, vol: result.tangency.vol, ret: result.tangency.ret, sharpe: result.tangency.sharpe, color: "#eda100" } : null}
                gmv={result.gmv ? { key: "gmv", label: t.optimizer.minVol, vol: result.gmv.vol, ret: result.gmv.ret, sharpe: result.gmv.sharpe, color: "#041c54" } : null}
              />
              <div className="mt-2 flex justify-between text-[11.5px] font-bold text-muted">
                <span>↑ {t.optimizer.yAxis}</span>
                <span>{t.optimizer.xAxis} →</span>
              </div>
            </>
          ) : null}
          <p className="mt-4 text-[12px] leading-relaxed text-muted">{t.optimizer.note}</p>
        </div>

        <div className="space-y-4">
          {result
            ? (
                [
                  ["tangency", t.optimizer.maxSharpe, result.tangency, "#eda100"],
                  ["gmv", t.optimizer.minVol, result.gmv, "#041c54"],
                ] as const
              ).map(([key, label, point, color]) =>
                point ? (
                  <div key={key} className="rounded-2xl border border-line p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[15px] font-extrabold text-ink">{label}</h4>
                      <Badge tone="navy">{t.optimizer.sharpe} {f.num(point.sharpe, 2)}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                      <div className="rounded-xl bg-[#f6f8fc] px-3 py-2">
                        <div className="font-bold text-muted">{t.optimizer.expectedReturn}</div>
                        <div className="tnum ltr text-[16px] font-extrabold text-ink">{f.pct(point.ret, 1)}</div>
                      </div>
                      <div className="rounded-xl bg-[#f6f8fc] px-3 py-2">
                        <div className="font-bold text-muted">{t.optimizer.volatility}</div>
                        <div className="tnum ltr text-[16px] font-extrabold text-ink">{f.pct(point.vol, 1)}</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <WeightsList point={point} tickers={tickers} color={color} />
                    </div>
                    {(() => {
                      const est = estimatedShare(point);
                      return est > 0.005 ? (
                        <p className={`mt-3 text-[12px] font-bold ${est > 0.3 ? "text-warning-text" : "text-muted"}`}>
                          {est > 0.3 ? "⚠ " : ""}
                          {t.optimizer.estimatedShare(f.pct(est, 0))}
                        </p>
                      ) : null;
                    })()}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="primary" onClick={() => apply(point, label, false)}>
                        {t.optimizer.applyActive}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => apply(point, label, true)} disabled={portfolios.length >= MAX_PORTFOLIOS}>
                        {t.optimizer.applyNew}
                      </Button>
                    </div>
                  </div>
                ) : null,
              )
            : null}

          {kept.length ? (
            <details className="rounded-2xl border border-line p-4">
              <summary className="cursor-pointer text-[13.5px] font-extrabold text-ink">
                {t.optimizer.min} / {t.optimizer.max}
              </summary>
              <ul className="mt-3 space-y-1.5">
                {tickers.map((tk) => {
                  const [lo, hi] = bounds(tk);
                  return (
                    <li key={tk} className="flex items-center justify-between gap-2">
                      <span className="ltr text-[13px] font-extrabold text-ink">{tk}</span>
                      <span className="flex items-center gap-1.5">
                        <NumberField value={lo} onCommit={(v) => setCustom((c) => ({ ...c, [tk]: [Math.min(v, hi), hi] }))} label={`${t.optimizer.min} ${tk}`} width="w-[4.25rem]" />
                        <span className="text-faint">–</span>
                        <NumberField value={hi} onCommit={(v) => setCustom((c) => ({ ...c, [tk]: [lo, Math.max(v, lo)] }))} label={`${t.optimizer.max} ${tk}`} width="w-[4.25rem]" />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
