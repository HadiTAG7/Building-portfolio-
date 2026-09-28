"use client";

import { useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/i18n/I18nProvider";
import { sampleIndices } from "@/lib/analysis";
import { AXIS_STROKE, AXIS_TICK, GRID_STROKE, SeriesTooltip, timeTicks, yearOrMonth } from "./ChartParts";

export interface TimeSeries {
  id: string;
  label: string;
  color: string;
  values: ArrayLike<number>;
}

export function TimeSeriesChart({
  dates,
  series,
  formatValue,
  formatAxis,
  height = 320,
  log = false,
  area = false,
  zeroLine = false,
  maxPoints = 650,
}: {
  dates: string[];
  series: TimeSeries[];
  formatValue: (v: number) => string;
  formatAxis?: (v: number) => string;
  height?: number;
  log?: boolean;
  area?: boolean;
  zeroLine?: boolean;
  maxPoints?: number;
}) {
  const { f } = useI18n();
  const { data, ticks, tickLabel } = useMemo(() => {
    const idx = sampleIndices(dates.length, maxPoints);
    const rows = idx.map((k) => {
      const row: Record<string, string | number> = { date: dates[k] };
      for (const s of series) row[s.id] = s.values[k];
      return row;
    });
    const sampledDates = idx.map((k) => dates[k]);
    const span = dates.length ? (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / (365.25 * 864e5) : 0;
    return { data: rows, ticks: timeTicks(sampledDates), tickLabel: yearOrMonth(span, f.monthYear) };
  }, [dates, series, maxPoints, f]);

  const single = series.length === 1;
  return (
    <div dir="ltr" style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={tickLabel}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: AXIS_STROKE }}
            minTickGap={16}
          />
          <YAxis
            scale={log ? "log" : "auto"}
            domain={log ? ["auto", "auto"] : ["auto", "auto"]}
            allowDataOverflow={false}
            tickFormatter={formatAxis ?? formatValue}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={68}
          />
          {zeroLine ? <ReferenceLine y={0} stroke={AXIS_STROKE} /> : null}
          <Tooltip
            content={<SeriesTooltip series={series} formatValue={formatValue} formatLabel={(l) => f.date(String(l))} sort />}
            cursor={{ stroke: "#9aa3b5", strokeWidth: 1 }}
            isAnimationActive={false}
          />
          {series.map((s) =>
            area && single ? (
              <Area
                key={s.id}
                dataKey={s.id}
                name={s.label}
                type="monotone"
                stroke={s.color}
                strokeWidth={2}
                fill={s.color}
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.id}
                dataKey={s.id}
                name={s.label}
                type="monotone"
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                isAnimationActive={false}
              />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
