"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { PerformanceMetrics } from "@/lib/finance/metrics";
import { usePortfolioStore } from "@/lib/store";
import { Card, CardHeader, cx, InfoTip } from "../ui";
import type { SeriesInfo } from "./ResultsPanel";

type Better = "high" | "low" | null;

interface Row {
  key: string;
  label: string;
  help?: string;
  better: Better;
  value: (m: PerformanceMetrics, amount: number) => number | null;
  format: (v: number | null) => ReactNode;
}

export function CompareTab({ series }: { series: SeriesInfo[] }) {
  const { t, f } = useI18n();
  const amount = usePortfolioStore((s) => s.settings.amount);
  const signed = (v: number | null, digits = 2) => <span className={cx("ltr", v !== null && v < 0 && "text-critical")}>{f.pct(v, digits)}</span>;

  const rows: Row[] = [
    { key: "finalValue", label: t.metrics.finalValue, better: "high", value: (m, a) => m.finalWealth * a, format: (v) => <span className="ltr">{f.money(v)}</span> },
    { key: "days", label: t.metrics.days, better: null, value: (m) => m.days, format: (v) => f.int(v) },
    { key: "cumulative", label: t.metrics.cumulative, help: t.metrics.help.cumulative, better: "high", value: (m) => m.cumulative, format: (v) => signed(v, 1) },
    { key: "cagr", label: t.metrics.cagr, help: t.metrics.help.cagr, better: "high", value: (m) => m.cagr, format: (v) => signed(v) },
    { key: "avgDaily", label: t.metrics.avgDaily, help: t.metrics.help.avgDaily, better: "high", value: (m) => m.avgDaily, format: (v) => signed(v, 3) },
    { key: "volatility", label: t.metrics.volatility, help: t.metrics.help.volatility, better: "low", value: (m) => m.volatility, format: (v) => signed(v) },
    { key: "sharpe", label: t.metrics.sharpe, help: t.metrics.help.sharpe, better: "high", value: (m) => m.sharpe, format: (v) => <span className="ltr">{f.num(v, 2)}</span> },
    { key: "sortino", label: t.metrics.sortino, help: t.metrics.help.sortino, better: "high", value: (m) => m.sortino, format: (v) => <span className="ltr">{f.num(v, 2)}</span> },
    { key: "bestDay", label: t.metrics.bestDay, help: t.metrics.help.bestDay, better: null, value: (m) => m.bestDay, format: (v) => signed(v) },
    { key: "worstDay", label: t.metrics.worstDay, help: t.metrics.help.worstDay, better: "high", value: (m) => m.worstDay, format: (v) => signed(v) },
    { key: "maxDrawdown", label: t.metrics.maxDrawdown, help: t.metrics.help.maxDrawdown, better: "high", value: (m) => m.maxDrawdown, format: (v) => signed(v) },
    { key: "downsideDeviation", label: t.metrics.downsideDeviation, help: t.metrics.help.downsideDeviation, better: "low", value: (m) => m.downsideDeviation, format: (v) => signed(v) },
    { key: "currentDrawdown", label: t.metrics.currentDrawdown, better: null, value: (m) => m.currentDrawdown, format: (v) => signed(v, 1) },
  ];

  const best = (row: Row): number | null => {
    if (!row.better || series.length < 2) return null;
    const vals = series.map((s) => row.value(s.a.metrics, amount)).filter((v): v is number => v !== null && Number.isFinite(v));
    if (!vals.length) return null;
    return row.better === "high" ? Math.max(...vals) : Math.min(...vals);
  };

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader title={t.results.tabs.compare} subtitle={t.results.subtitle} />
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f6f8fc]">
              <th scope="col" className="sticky start-0 z-10 bg-[#f6f8fc] px-3 py-3 text-start text-[12px] font-bold text-muted">
                {t.common.metric}
              </th>
              {series.map((s) => (
                <th key={s.id} scope="col" className="whitespace-nowrap px-3 py-3 text-start text-[12.5px] font-extrabold text-ink">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const b = best(row);
              return (
                <tr key={row.key} className="border-t border-line">
                  <th scope="row" className="sticky start-0 z-10 whitespace-nowrap bg-surface px-3 py-2.5 text-start font-bold text-ink">
                    <span className="inline-flex items-center gap-1.5">
                      {row.label}
                      {row.help ? <InfoTip text={row.help} /> : null}
                    </span>
                  </th>
                  {series.map((s) => {
                    const v = row.value(s.a.metrics, amount);
                    const isBest = b !== null && v !== null && Math.abs(v - b) < 1e-12;
                    return (
                      <td key={s.id} className={cx("tnum whitespace-nowrap px-3 py-2.5", isBest ? "font-extrabold text-ink" : "text-ink-2")}>
                        {row.format(v)}
                        {isBest ? <span className="ms-1.5 text-[10px] text-[#11704f]" aria-hidden>●</span> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {series.length > 1 ? <p className="mt-2 text-[11.5px] font-bold text-[#11704f]">{t.results.bestNote}</p> : null}
    </Card>
  );
}
