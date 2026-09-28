"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { correlationMatrix } from "@/lib/finance/stats";
import type { IndexWindow, MarketData } from "@/lib/finance/types";
import { divergingColor, DivergingLegend } from "../charts/ChartParts";
import { Badge, Card, CardHeader, DataTable, Segmented, Signed } from "../ui";
import type { SeriesInfo } from "./ResultsPanel";

function CorrelationCard({ market, range, series }: { market: MarketData; range: IndexWindow; series: SeriesInfo[] }) {
  const { t, f } = useI18n();
  const [scope, setScope] = useState<"held" | "all">("held");
  const assets = useMemo(() => {
    if (scope === "all") return market.tickers.map((_, i) => i);
    const held = new Set<number>();
    for (const s of series) s.a.weights.forEach((w, i) => w > 0 && held.add(i));
    return [...held].sort((a, b) => a - b);
  }, [scope, market, series]);
  const matrix = useMemo(() => correlationMatrix(market, assets, range), [market, assets, range]);
  const dense = assets.length > 12;
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        title={t.charts.correlation}
        subtitle={t.charts.correlationSub}
        actions={
          <Segmented
            size="sm"
            value={scope}
            onChange={setScope}
            options={[
              { value: "held", label: t.optimizer.universeHeld },
              { value: "all", label: t.optimizer.universeAll },
            ]}
          />
        }
      />
      <div className="mt-3">
        <DivergingLegend min="-1" max="+1" />
      </div>
      {assets.length < 2 ? (
        <p className="mt-6 text-[13px] text-muted">{t.optimizer.tooFew}</p>
      ) : (
        <div className="mt-4 overflow-x-auto" dir="ltr">
          <table className="border-separate border-spacing-[2px] text-[11px]">
            <thead>
              <tr>
                <th />
                {assets.map((i) => (
                  <th key={i} className="px-1 pb-1 text-center font-extrabold text-ink-2">
                    <span className={dense ? "inline-block origin-bottom-left -rotate-45 whitespace-nowrap" : ""}>{market.tickers[i]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((i, r) => (
                <tr key={i}>
                  <th className="pe-2 text-end font-extrabold text-ink-2">{market.tickers[i]}</th>
                  {assets.map((j, c) => {
                    const v = matrix[r][c];
                    const col = divergingColor(v, 1);
                    return (
                      <td
                        key={j}
                        title={`${market.tickers[i]} × ${market.tickers[j]}: ${f.num(v, 2)}`}
                        className={`tnum rounded-md text-center font-bold ${dense ? "h-8 w-9" : "h-10 w-12"}`}
                        style={{ background: col.bg, color: col.fg }}
                      >
                        {f.num(v, 2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function RiskTab({ market, range, series }: { market: MarketData; range: IndexWindow; series: SeriesInfo[] }) {
  const { t, f } = useI18n();
  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <CardHeader title={t.charts.drawdownTable} subtitle={t.charts.drawdownSub} />
        <DataTable
          className="mt-4"
          head={[
            t.common.portfolio,
            t.metrics.maxDrawdown,
            t.charts.peak,
            t.charts.trough,
            t.charts.recovery,
            t.metrics.currentDrawdown,
            t.metrics.nearHigh,
            t.metrics.volatility,
            t.metrics.downsideDeviation,
          ]}
          rows={series.map((s) => {
            const m = s.a.metrics;
            return [
              <span key="n" className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>,
              <Signed key="dd" value={m.maxDrawdown} text={f.pct(m.maxDrawdown, 1)} />,
              f.shortDate(m.peakDate),
              f.shortDate(m.troughDate),
              m.recoveryDate ? f.shortDate(m.recoveryDate) : <Badge key="r" tone="amber">{t.charts.notRecovered}</Badge>,
              <Signed key="c" value={m.currentDrawdown} text={f.pct(m.currentDrawdown, 1)} />,
              m.nearHigh ? <Badge key="h" tone="green">{t.common.yes}</Badge> : <Badge key="h" tone="gray">{t.common.no}</Badge>,
              f.pct(m.volatility, 1),
              f.pct(m.downsideDeviation, 1),
            ];
          })}
        />
      </Card>
      <CorrelationCard market={market} range={range} series={series} />
    </div>
  );
}
