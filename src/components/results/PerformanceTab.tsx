"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { PortfolioAnalysis } from "@/lib/analysis";
import { usePortfolioStore } from "@/lib/store";
import { TimeSeriesChart } from "../charts/TimeSeriesChart";
import { Card, ChartCard, cx, DataTable, InfoTip, Legend, Signed, Switch } from "../ui";
import type { SeriesInfo } from "./ResultsPanel";

function Stat({ label, value, help, sub, tone }: { label: string; value: string; help?: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-muted">
        <span>{label}</span>
        {help ? <InfoTip text={help} /> : null}
      </div>
      <div className={cx("ltr mt-1.5 text-[22px] font-extrabold leading-tight", tone === "bad" ? "text-critical" : tone === "good" ? "text-good-text" : "text-ink")}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-[11.5px] text-muted">{sub}</div> : null}
    </div>
  );
}

export function KpiBlock({ series }: { series: SeriesInfo }) {
  const { t, f } = useI18n();
  const amount = usePortfolioStore((s) => s.settings.amount);
  const m = series.a.metrics;
  const finalValue = amount * m.finalWealth;
  const valueText = f.money(finalValue);
  const valueSize = valueText.length > 15 ? "text-[28px] md:text-[32px]" : valueText.length > 12 ? "text-[32px] md:text-[38px]" : "text-[40px] md:text-[46px]";
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
      <Card className="relative overflow-hidden bg-hero p-5 text-white sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -top-24 end-[-20%] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(14,128,231,0.5),transparent_65%)]" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[13px] font-bold text-white/70">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: series.color }} />
            {series.label}
          </div>
          <div className="mt-3 text-[13px] text-white/70">{t.metrics.finalValue}</div>
          <div className={cx("ltr mt-1 font-extrabold leading-tight", valueSize)}>{valueText}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            <span className={cx("ltr rounded-full px-2.5 py-1 font-extrabold", m.cumulative >= 0 ? "bg-green/20 text-[#c0f1cb]" : "bg-critical/25 text-[#ffd0cf]")}>
              {f.signedPct(m.cumulative)}
            </span>
            <span className="text-white/70">{t.metrics.cumulative}</span>
          </div>
          {series.a.invested < 0.9999 ? (
            <p className="mt-3 text-[12px] text-[#ffe6a8]">{t.results.cash(f.pct(1 - series.a.invested, 1))}</p>
          ) : null}
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label={t.metrics.cagr} value={f.pct(m.cagr, 2)} help={t.metrics.help.cagr} sub={m.shortWindow ? t.metrics.shortWindow : undefined} />
        <Stat label={t.metrics.volatility} value={f.pct(m.volatility, 2)} help={t.metrics.help.volatility} />
        <Stat label={t.metrics.sharpe} value={f.num(m.sharpe, 2)} help={t.metrics.help.sharpe} />
        <Stat label={t.metrics.sortino} value={f.num(m.sortino, 2)} help={t.metrics.help.sortino} />
        <Stat
          label={t.metrics.maxDrawdown}
          value={f.pct(m.maxDrawdown, 1)}
          help={t.metrics.help.maxDrawdown}
          sub={m.troughDate ? `${t.charts.trough}: ${f.shortDate(m.troughDate)}` : undefined}
          tone={m.maxDrawdown < 0 ? "bad" : undefined}
        />
        <Stat
          label={`${t.metrics.bestDay} / ${t.metrics.worstDay}`}
          value={`${f.signedPct(m.bestDay, 1)} / ${f.signedPct(m.worstDay, 1)}`}
          sub={m.bestDayDate && m.worstDayDate ? `${f.shortDate(m.bestDayDate)} · ${f.shortDate(m.worstDayDate)}` : undefined}
        />
      </div>
    </div>
  );
}

export function PerformanceTab({ series, active }: { series: SeriesInfo[]; active: SeriesInfo | null }) {
  const { t, f } = useI18n();
  const settings = usePortfolioStore((s) => s.settings);
  const update = usePortfolioStore((s) => s.updateSettings);
  const dates = useMemo(() => series[0]?.a.backtest.dates ?? [], [series]);

  const growth = useMemo(
    () =>
      series.map((s) => ({
        id: s.id,
        label: s.label,
        color: s.color,
        values: Array.from(s.a.backtest.wealth, (w) => w * settings.amount),
      })),
    [series, settings.amount],
  );
  const drawdown = useMemo(
    () => series.map((s) => ({ id: s.id, label: s.label, color: s.color, values: s.a.backtest.drawdown })),
    [series],
  );
  const legend = series.map((s) => ({ key: s.id, color: s.color, label: s.label }));

  const yearEnds = useMemo(() => {
    const idx: number[] = [];
    for (let k = 0; k < dates.length; k++) if (k === dates.length - 1 || dates[k + 1].slice(0, 4) !== dates[k].slice(0, 4)) idx.push(k);
    return idx;
  }, [dates]);

  return (
    <div className="space-y-6">
      {active ? <KpiBlock series={active} /> : null}
      <ChartCard
        title={t.charts.growth}
        subtitle={t.charts.growthSub(f.money(settings.amount))}
        showTableLabel={t.common.showTable}
        showChartLabel={t.common.showChart}
        actions={<Switch checked={settings.logScale} onChange={(v) => update({ logScale: v })} label={t.charts.logScale} />}
        table={
          <DataTable
            head={[t.common.date, ...series.map((s) => s.label)]}
            rows={yearEnds.map((k) => [f.shortDate(dates[k]), ...series.map((s) => <span key={s.id} className="ltr">{f.money(s.a.backtest.wealth[k] * settings.amount)}</span>)])}
          />
        }
      >
        <Legend items={legend} />
        <div className="mt-3">
          <TimeSeriesChart
            dates={dates}
            series={growth}
            log={settings.logScale}
            formatValue={(v) => f.money(v)}
            formatAxis={(v) => f.compactMoney(v)}
            height={340}
          />
        </div>
      </ChartCard>
      <ChartCard
        title={t.charts.drawdown}
        subtitle={t.charts.drawdownSub}
        showTableLabel={t.common.showTable}
        showChartLabel={t.common.showChart}
        table={
          <DataTable
            head={[t.common.portfolio, t.metrics.maxDrawdown, t.charts.peak, t.charts.trough, t.charts.recovery, t.metrics.currentDrawdown]}
            rows={series.map((s) => [
              s.label,
              <Signed key="dd" value={s.a.metrics.maxDrawdown} text={f.pct(s.a.metrics.maxDrawdown, 1)} />,
              f.shortDate(s.a.metrics.peakDate),
              f.shortDate(s.a.metrics.troughDate),
              s.a.metrics.recoveryDate ? f.shortDate(s.a.metrics.recoveryDate) : t.charts.notRecovered,
              <Signed key="cur" value={s.a.metrics.currentDrawdown} text={f.pct(s.a.metrics.currentDrawdown, 1)} />,
            ])}
          />
        }
      >
        <Legend items={legend} />
        <div className="mt-3">
          <TimeSeriesChart dates={dates} series={drawdown} area formatValue={(v) => f.pct(v, 1)} formatAxis={(v) => f.pct(v, 0)} height={260} />
        </div>
      </ChartCard>
    </div>
  );
}

export type { PortfolioAnalysis };
