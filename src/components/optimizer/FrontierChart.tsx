"use client";

import { CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/i18n/I18nProvider";
import { AXIS_STROKE, AXIS_TICK, GRID_STROKE, TooltipBox } from "../charts/ChartParts";

export interface ScatterPoint {
  key: string;
  label: string;
  vol: number;
  ret: number;
  sharpe: number | null;
  color: string;
}

const INK = "#041c54";
const ASSET = "#9aa3b5";

interface HoverPayload {
  payload?: ScatterPoint;
}

function PointTooltip({ active, payload }: { active?: boolean; payload?: readonly HoverPayload[] }) {
  const { t, f } = useI18n();
  const p = payload?.find((x) => x.payload?.label)?.payload;
  if (!active || !p) return null;
  return (
    <TooltipBox
      title={p.label}
      rows={[
        { key: "r", color: p.color, label: t.optimizer.expectedReturn, value: f.pct(p.ret, 1) },
        { key: "v", color: p.color, label: t.optimizer.volatility, value: f.pct(p.vol, 1) },
        { key: "s", color: p.color, label: t.optimizer.sharpe, value: f.num(p.sharpe, 2) },
      ]}
    />
  );
}

interface LabelProps {
  x?: number | string;
  y?: number | string;
  value?: unknown;
}

/** Point label drawn as plain SVG text (LabelList would wrap multi-word names). */
function pointLabel(position: "right" | "top" | "left", style: { fill: string; fontSize: number; fontWeight: number }) {
  function PointLabel({ x = 0, y = 0, value }: LabelProps) {
    const px = Number(x);
    const py = Number(y);
    const dx = position === "right" ? 9 : position === "left" ? -12 : 0;
    const dy = position === "top" ? -12 : 4;
    const anchor = position === "right" ? "start" : position === "left" ? "end" : "middle";
    return (
      <text x={px + dx} y={py + dy} textAnchor={anchor} fill={style.fill} fontSize={style.fontSize} fontWeight={style.fontWeight} fontFamily="var(--font-sans)">
        {String(value ?? "")}
      </text>
    );
  }
  return PointLabel;
}

const AssetLabel = pointLabel("right", { fill: "#6b6e7b", fontSize: 10, fontWeight: 700 });
const PortfolioLabel = pointLabel("top", { fill: "#050717", fontSize: 11, fontWeight: 800 });
const MarkerLabel = pointLabel("left", { fill: "#041c54", fontSize: 11, fontWeight: 800 });

function Star({ cx = 0, cy = 0 }: { cx?: number; cy?: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 8 : 3.6;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
  return <polygon points={pts} fill="#eda100" stroke="#fff" strokeWidth={1.5} />;
}

function Diamond({ cx = 0, cy = 0 }: { cx?: number; cy?: number }) {
  return <polygon points={`${cx},${cy - 7} ${cx + 7},${cy} ${cx},${cy + 7} ${cx - 7},${cy}`} fill={INK} stroke="#fff" strokeWidth={1.5} />;
}

function Dot({ cx = 0, cy = 0, fill, r = 5 }: { cx?: number; cy?: number; fill?: string; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke="#fff" strokeWidth={2} />;
}

export function FrontierChart({
  frontier,
  assets,
  portfolios,
  tangency,
  gmv,
}: {
  frontier: { vol: number; ret: number }[];
  assets: ScatterPoint[];
  portfolios: ScatterPoint[];
  tangency: ScatterPoint | null;
  gmv: ScatterPoint | null;
}) {
  const { f } = useI18n();
  return (
    <div dir="ltr" className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 16, right: 56, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={GRID_STROKE} />
          <XAxis type="number" dataKey="vol" domain={[0, "auto"]} tickFormatter={(v) => f.pct(v, 0)} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: AXIS_STROKE }} />
          <YAxis type="number" dataKey="ret" domain={["auto", "auto"]} tickFormatter={(v) => f.pct(v, 0)} tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
          <Tooltip content={<PointTooltip />} shared={false} cursor={false} isAnimationActive={false} />
          <Line data={frontier} dataKey="ret" type="monotone" stroke={INK} strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} legendType="none" tooltipType="none" />
          <Scatter data={assets} fill={ASSET} shape={<Dot r={4} />} isAnimationActive={false}>
            <LabelList dataKey="label" content={<AssetLabel />} />
          </Scatter>
          {portfolios.map((p) => (
            <Scatter key={p.key} data={[p]} fill={p.color} shape={<Dot r={6} />} isAnimationActive={false}>
              <LabelList dataKey="label" content={<PortfolioLabel />} />
            </Scatter>
          ))}
          {gmv ? (
            <Scatter data={[gmv]} shape={<Diamond />} isAnimationActive={false}>
              <LabelList dataKey="label" content={<MarkerLabel />} />
            </Scatter>
          ) : null}
          {tangency ? (
            <Scatter data={[tangency]} shape={<Star />} isAnimationActive={false}>
              <LabelList dataKey="label" content={<MarkerLabel />} />
            </Scatter>
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
