"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/i18n/I18nProvider";
import { AXIS_STROKE, AXIS_TICK, divergingColor, DivergingLegend, GRID_STROKE, RoundedBar, SeriesTooltip } from "../charts/ChartParts";
import { TimeSeriesChart } from "../charts/TimeSeriesChart";
import { Card, CardHeader, ChartCard, DataTable, Legend, Signed } from "../ui";
import type { SeriesInfo } from "./ResultsPanel";

function CalendarChart({ series }: { series: SeriesInfo[] }) {
  const { f } = useI18n();
  const years = useMemo(() => {
    const set = new Map<number, boolean>();
    for (const s of series) for (const y of s.a.calendar) set.set(y.year, (set.get(y.year) ?? false) || y.partial);
    return [...set.entries()].sort((a, b) => a[0] - b[0]);
  }, [series]);
  const data = useMemo(
    () =>
      years.map(([year, partial]) => {
        const row: Record<string, number | string> = { year: partial ? `${year}*` : String(year) };
        for (const s of series) {
          const r = s.a.calendar.find((c) => c.year === year);
          if (r) row[s.id] = r.ret;
        }
        return row;
      }),
    [years, series],
  );
  const keys = useMemo(() => series.map((s) => ({ id: s.id, label: s.label, color: s.color })), [series]);
  return (
    <div dir="ltr" className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={2} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="year" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: AXIS_STROKE }} />
          <YAxis tickFormatter={(v) => f.pct(v, 0)} tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} />
          <ReferenceLine y={0} stroke={AXIS_STROKE} />
          <Tooltip
            content={<SeriesTooltip series={keys} formatValue={(v) => f.signedPct(v, 1)} formatLabel={(l) => String(l)} />}
            cursor={{ fill: "rgba(14,128,231,0.06)" }}
            isAnimationActive={false}
          />
          {series.map((s) => (
            <Bar key={s.id} dataKey={s.id} name={s.label} fill={s.color} maxBarSize={24} shape={<RoundedBar />} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthlyHeatmap({ series }: { series: SeriesInfo }) {
  const { t, f } = useI18n();
  const rows = useMemo(() => {
    const byYear = new Map<number, (number | null)[]>();
    for (const m of series.a.monthly) {
      const r = byYear.get(m.year) ?? new Array<number | null>(12).fill(null);
      r[m.month - 1] = m.ret;
      byYear.set(m.year, r);
    }
    return [...byYear.entries()].sort((a, b) => a[0] - b[0]);
  }, [series]);
  const yearRet = new Map(series.a.calendar.map((c) => [c.year, c]));
  const maxAbs = Math.max(0.05, ...series.a.monthly.map((m) => Math.abs(m.ret)));
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader title={t.charts.monthly(series.label)} subtitle={t.charts.monthlySub} actions={<DivergingLegend min={f.pct(-maxAbs, 0)} max={f.pct(maxAbs, 0)} />} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-[2px] text-[11.5px]">
          <thead>
            <tr>
              <th className="px-2 py-1 text-start font-bold text-muted">{t.charts.yearCol}</th>
              {t.charts.months.map((m) => (
                <th key={m} className="px-1 py-1 text-center font-bold text-muted">
                  {m}
                </th>
              ))}
              <th className="px-2 py-1 text-center font-extrabold text-ink">{t.common.total}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([year, months]) => {
              const y = yearRet.get(year);
              return (
                <tr key={year}>
                  <th className="px-2 py-1.5 text-start font-extrabold text-ink">{year}</th>
                  {months.map((v, i) => {
                    const c = divergingColor(v, maxAbs);
                    return (
                      <td key={i} className="tnum rounded-md px-1 py-1.5 text-center font-bold" style={{ background: c.bg, color: c.fg }} title={v === null ? undefined : `${t.charts.months[i]} ${year}: ${f.signedPct(v, 2)}`}>
                        {v === null ? "" : f.num(v * 100, 1)}
                      </td>
                    );
                  })}
                  <td className="tnum rounded-md bg-[#f1f3f7] px-2 py-1.5 text-center font-extrabold text-ink">
                    {y ? f.signedPct(y.ret, 1) : ""}
                    {y?.partial ? "*" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] text-muted">* {t.charts.partialYear} · %</p>
    </Card>
  );
}

export function ReturnsTab({ series, active }: { series: SeriesInfo[]; active: SeriesInfo | null }) {
  const { t, f } = useI18n();
  const legend = series.map((s) => ({ key: s.id, color: s.color, label: s.label }));
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const s of series) for (const y of s.a.calendar) set.add(y.year);
    return [...set].sort((a, b) => a - b);
  }, [series]);
  const rollingDates = series[0]?.a.rolling.dates ?? [];
  const rolling = useMemo(
    () => series.map((s) => ({ id: s.id, label: s.label, color: s.color, values: s.a.rolling.returns })),
    [series],
  );

  return (
    <div className="space-y-6">
      <ChartCard
        title={t.charts.calendar}
        subtitle={t.charts.calendarSub}
        showTableLabel={t.common.showTable}
        showChartLabel={t.common.showChart}
        table={
          <DataTable
            head={[t.common.year, ...series.map((s) => s.label)]}
            rows={years.map((y) => [
              String(y),
              ...series.map((s) => {
                const r = s.a.calendar.find((c) => c.year === y);
                return r ? <Signed key={s.id} value={r.ret} text={`${f.signedPct(r.ret, 1)}${r.partial ? "*" : ""}`} /> : t.common.none;
              }),
            ])}
          />
        }
      >
        <Legend items={legend} kind="rect" />
        <div className="mt-3">
          <CalendarChart series={series} />
        </div>
        <p className="mt-1 text-[11.5px] text-muted">* {t.charts.partialYear}</p>
      </ChartCard>

      {active ? <MonthlyHeatmap series={active} /> : null}

      <ChartCard
        title={t.charts.rolling}
        subtitle={t.charts.rollingSub}
        showTableLabel={t.common.showTable}
        showChartLabel={t.common.showChart}
        table={
          <DataTable
            head={[t.common.portfolio, t.charts.rollingStats.best, t.charts.rollingStats.worst, t.charts.rollingStats.average, t.charts.rollingStats.positive]}
            rows={series.map((s) => [
              s.label,
              <Signed key="b" value={s.a.rolling.best} text={f.signedPct(s.a.rolling.best, 1)} />,
              <Signed key="w" value={s.a.rolling.worst} text={f.signedPct(s.a.rolling.worst, 1)} />,
              <Signed key="a" value={s.a.rolling.average} text={f.signedPct(s.a.rolling.average, 1)} />,
              f.pct(s.a.rolling.positiveShare, 0),
            ])}
          />
        }
      >
        {rollingDates.length ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {(["best", "worst", "average", "positive"] as const).map((k) => (
                <div key={k} className="rounded-2xl bg-[#f6f8fc] px-3 py-2.5">
                  <div className="text-[11.5px] font-bold text-muted">{t.charts.rollingStats[k]}</div>
                  <div className="mt-1 space-y-0.5">
                    {series.map((s) => {
                      const v = k === "best" ? s.a.rolling.best : k === "worst" ? s.a.rolling.worst : k === "average" ? s.a.rolling.average : s.a.rolling.positiveShare;
                      return (
                        <div key={s.id} className="flex items-center gap-1.5 text-[12.5px]">
                          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                          <span className="tnum ltr font-extrabold text-ink">{k === "positive" ? f.pct(v, 0) : f.signedPct(v, 1)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <Legend items={legend} />
            <div className="mt-3">
              <TimeSeriesChart dates={rollingDates} series={rolling} zeroLine formatValue={(v) => f.signedPct(v, 1)} formatAxis={(v) => f.pct(v, 0)} height={280} />
            </div>
          </>
        ) : (
          <p className="text-[13px] text-muted">{t.charts.rollingEmpty}</p>
        )}
      </ChartCard>
    </div>
  );
}
