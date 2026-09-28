"use client";

import { useMemo, useState } from "react";
import { assetInfo } from "@/data/assets";
import { useI18n } from "@/i18n/I18nProvider";
import { assetCumulativeReturn } from "@/lib/finance/backtest";
import type { IndexWindow, MarketData } from "@/lib/finance/types";
import { Card, CardHeader, cx, DataTable, Segmented, Signed } from "../ui";
import type { SeriesInfo } from "./ResultsPanel";

function Bars({ items, color, format }: { items: { key: string; label: string; sub?: string; value: number }[]; color: string; format: (v: number) => string }) {
  const max = Math.max(...items.map((i) => i.value), 1e-9);
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[minmax(84px,150px)_minmax(0,1fr)_64px] items-center gap-3">
          <div className="min-w-0">
            <div className="ltr truncate text-[13px] font-extrabold text-ink">{i.label}</div>
            {i.sub ? <div className="truncate text-[11px] text-muted">{i.sub}</div> : null}
          </div>
          <div className="h-3 rounded-full bg-[#eef2f8]">
            <div className="h-full rounded-e-[4px] rounded-s-none" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
          <div className="tnum ltr text-end text-[13px] font-extrabold text-ink">{format(i.value)}</div>
        </li>
      ))}
    </ul>
  );
}

function ContributionBars({ rows, format }: { rows: { key: string; label: string; value: number }[]; format: (v: number) => string }) {
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9);
  const hasNegative = rows.some((r) => r.value < 0);
  return (
    <ul className="space-y-2" dir="ltr">
      {rows.map((r) => {
        const width = (Math.abs(r.value) / maxAbs) * (hasNegative ? 50 : 100);
        return (
          <li key={r.key} className="grid grid-cols-[64px_minmax(0,1fr)_72px] items-center gap-3">
            <span className="truncate text-[13px] font-extrabold text-ink">{r.label}</span>
            <div className="relative h-3 rounded-full bg-[#eef2f8]">
              {hasNegative ? <span className="absolute inset-y-[-3px] left-1/2 w-px bg-line-strong" /> : null}
              <span
                className={cx("absolute inset-y-0", r.value >= 0 ? "rounded-r-[4px]" : "rounded-l-[4px]")}
                style={{
                  width: `${width}%`,
                  left: r.value >= 0 ? (hasNegative ? "50%" : "0") : `${50 - width}%`,
                  background: r.value >= 0 ? "#0e80e7" : "#e34948",
                }}
              />
            </div>
            <span className={cx("tnum text-end text-[13px] font-extrabold", r.value < 0 ? "text-critical" : "text-ink")}>{format(r.value)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function AllocationTab({ market, range, active }: { market: MarketData; range: IndexWindow; active: SeriesInfo | null }) {
  const { t, f } = useI18n();
  const [mode, setMode] = useState<"asset" | "class">("asset");
  const isAr = t.dir === "rtl";

  const rows = useMemo(() => {
    if (!active) return [];
    return active.a.weights
      .map((w, i) => ({ i, w }))
      .filter((x) => x.w > 0)
      .map(({ i, w }) => {
        const ticker = market.tickers[i];
        const info = assetInfo(ticker);
        return {
          ticker,
          className: isAr ? info.classAr : info.classEn,
          weight: w,
          assetReturn: assetCumulativeReturn(market.returns[i], range),
          contribution: active.a.backtest.contributions[i],
        };
      })
      .sort((a, b) => b.weight - a.weight);
  }, [active, market, range, isAr]);

  const byClass = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.className, (m.get(r.className) ?? 0) + r.weight);
    return [...m.entries()].map(([k, v]) => ({ key: k, label: k, value: v })).sort((a, b) => b.value - a.value);
  }, [rows]);

  if (!active) return null;
  const totalContribution = rows.reduce((a, r) => a + r.contribution, 0);

  return (
    <div className="grid gap-6 2xl:grid-cols-2">
      <Card className="p-5 sm:p-6">
        <CardHeader
          title={t.charts.allocation(active.label)}
          actions={
            <Segmented
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: "asset", label: t.charts.byAsset },
                { value: "class", label: t.charts.byClass },
              ]}
            />
          }
        />
        <div className="mt-5">
          {mode === "asset" ? (
            <Bars items={rows.map((r) => ({ key: r.ticker, label: r.ticker, sub: r.className, value: r.weight }))} color={active.color} format={(v) => f.pct(v, 1)} />
          ) : (
            <Bars items={byClass} color={active.color} format={(v) => f.pct(v, 1)} />
          )}
        </div>
        {active.a.invested < 0.9999 ? <p className="mt-4 text-[12px] font-bold text-warning-text">{t.results.cash(f.pct(1 - active.a.invested, 1))}</p> : null}
      </Card>
      <Card className="p-5 sm:p-6">
        <CardHeader title={t.charts.contribution(active.label)} subtitle={t.charts.contributionSub} />
        <div className="mt-5">
          <ContributionBars rows={[...rows].sort((a, b) => b.contribution - a.contribution).map((r) => ({ key: r.ticker, label: r.ticker, value: r.contribution }))} format={(v) => f.signedPct(v, 1)} />
        </div>
        <DataTable
          className="mt-5"
          head={[t.common.fund, t.common.weight, t.charts.assetReturn, t.charts.contributionCol]}
          rows={[
            ...rows.map((r) => [
              <span key="t" className="ltr">{r.ticker}</span>,
              f.pct(r.weight, 1),
              <Signed key="a" value={r.assetReturn} text={f.signedPct(r.assetReturn, 1)} />,
              <Signed key="c" value={r.contribution} text={f.signedPct(r.contribution, 2)} />,
            ]),
            [t.common.total, f.pct(active.a.invested, 1), "", <Signed key="tot" value={totalContribution} text={f.signedPct(totalContribution, 2)} />],
          ]}
        />
      </Card>
    </div>
  );
}
