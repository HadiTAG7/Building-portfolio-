"use client";

import type { ReactNode } from "react";

export const AXIS_TICK = { fill: "#6b6e7b", fontSize: 11, fontFamily: "var(--font-sans)" } as const;
export const GRID_STROKE = "#e8ecf3";
export const AXIS_STROKE = "#cfd6e3";

export interface TooltipRow {
  key: string;
  color: string;
  label: string;
  value: string;
  sortValue?: number;
}

/** Values lead, series names follow; one row per series at the hovered position. */
export function TooltipBox({ title, rows }: { title: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="min-w-[180px] rounded-xl border border-line bg-white/95 px-3 py-2.5 text-[12px] shadow-lg backdrop-blur" dir="auto">
      <div className="mb-1.5 font-bold text-muted">{title}</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="inline-block h-[3px] w-3.5 shrink-0 rounded-full" style={{ background: r.color }} />
            <span className="tnum ltr font-extrabold text-ink">{r.value}</span>
            <span className="truncate text-muted">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface RechartsTooltipLike {
  active?: boolean;
  label?: string | number;
  payload?: readonly { dataKey?: unknown; value?: unknown; color?: string; name?: unknown }[];
}

/**
 * Tooltip body for Recharts' `content` prop. Pass it as an element with the series
 * config; Recharts injects `active`, `payload` and `label`.
 */
export function SeriesTooltip({
  active,
  payload,
  label,
  series,
  formatValue,
  formatLabel,
  sort,
}: RechartsTooltipLike & {
  series: { id: string; label: string; color: string }[];
  formatValue: (v: number) => string;
  formatLabel: (label: string | number) => ReactNode;
  sort?: boolean;
}) {
  if (!active || !payload?.length || label === undefined) return null;
  const rows: TooltipRow[] = [];
  for (const p of payload) {
    const id = String(p.dataKey ?? "");
    const s = series.find((x) => x.id === id);
    if (!s || typeof p.value !== "number" || !Number.isFinite(p.value)) continue;
    rows.push({ key: id, color: s.color, label: s.label, value: formatValue(p.value), sortValue: p.value });
  }
  if (sort) rows.sort((a, b) => (b.sortValue ?? 0) - (a.sortValue ?? 0));
  return <TooltipBox title={formatLabel(label)} rows={rows} />;
}

/** Tick positions at the first sampled day of each year (or each quarter on short spans). */
export function timeTicks(dates: string[]): string[] {
  if (!dates.length) return [];
  const spanYears = (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / (365.25 * 864e5);
  const key = (d: string) => (spanYears >= 2.5 ? d.slice(0, 4) : `${d.slice(0, 4)}-${Math.floor((Number(d.slice(5, 7)) - 1) / 3)}`);
  const ticks: string[] = [];
  let last = "";
  for (const d of dates) {
    const k = key(d);
    if (k !== last) {
      if (last) ticks.push(d);
      last = k;
    }
  }
  const maxTicks = 12;
  if (ticks.length > maxTicks) {
    const step = Math.ceil(ticks.length / maxTicks);
    return ticks.filter((_, i) => i % step === 0);
  }
  return ticks;
}

export function yearOrMonth(spanYears: number, monthYear: (iso: string) => string) {
  return (d: string) => (spanYears >= 2.5 ? d.slice(0, 4) : monthYear(d));
}

// Diverging scale (blue positive / red negative, grey midpoint) for heatmaps.
const BLUE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const RED = ["#fde0df", "#f9bdbb", "#f2918d", "#e5635e", "#c94440", "#a12f2c", "#7a211f"];
const MID = "#f0efec";

export function divergingColor(value: number | null, maxAbs: number): { bg: string; fg: string } {
  if (value === null || !Number.isFinite(value) || maxAbs <= 0) return { bg: "#f6f7f9", fg: "#8a8d99" };
  const x = Math.min(1, Math.abs(value) / maxAbs);
  if (x < 0.04) return { bg: MID, fg: "#2a3834" };
  const idx = Math.min(BLUE.length - 1, Math.floor(x * BLUE.length));
  const bg = value >= 0 ? BLUE[idx] : RED[idx];
  return { bg, fg: idx >= 3 ? "#ffffff" : "#050717" };
}

export function DivergingLegend({ min, max, format }: { min: string; max: string; format?: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold text-muted" dir="ltr">
      <span>{min}</span>
      <span className="flex h-2.5 w-40 overflow-hidden rounded-full">
        {[...RED].reverse().map((c) => (
          <span key={c} className="flex-1" style={{ background: c }} />
        ))}
        <span className="flex-1" style={{ background: MID }} />
        {BLUE.map((c) => (
          <span key={c} className="flex-1" style={{ background: c }} />
        ))}
      </span>
      <span>{max}</span>
      {format ? <span className="text-faint">{format}</span> : null}
    </div>
  );
}

interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  value?: unknown;
}

/** Column with a 4px rounded data end and a square baseline, for positive and negative values. */
export function RoundedBar(props: BarShapeProps) {
  const { x = 0, y = 0, width = 0, fill } = props;
  let { height = 0 } = props;
  const value = Array.isArray(props.value) ? Number(props.value[1]) - Number(props.value[0]) : Number(props.value);
  if (!width || !height) return null;
  let top = y;
  if (height < 0) {
    top = y + height;
    height = -height;
  }
  const r = Math.min(4, width / 2, height);
  const negative = value < 0;
  const d = negative
    ? `M${x},${top} h${width} v${height - r} q0,${r} ${-r},${r} h${-(width - 2 * r)} q${-r},0 ${-r},${-r} z`
    : `M${x},${top + height} v${-(height - r)} q0,${-r} ${r},${-r} h${width - 2 * r} q${r},0 ${r},${r} v${height - r} z`;
  return <path d={d} fill={fill} />;
}
