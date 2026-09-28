"use client";

import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h3 className="text-[17px] font-bold leading-snug text-ink">{title}</h3>
        {subtitle ? <p className="mt-1 text-[13px] leading-relaxed text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  const base =
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue";
  const sizes = { sm: "h-8 px-3.5 text-[12.5px]", md: "h-10 px-5 text-[14px]" };
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-grad-blue text-white hover:brightness-110",
    secondary: "border border-line-strong bg-surface text-ink hover:border-blue hover:text-cobalt",
    ghost: "text-muted hover:bg-sky hover:text-cobalt",
    danger: "text-critical hover:bg-[#fdeeee]",
    soft: "bg-sky text-cobalt hover:bg-sky-2",
  };
  return (
    <button type="button" className={cx(base, sizes[size], variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}

type Tone = "blue" | "green" | "gray" | "red" | "amber" | "navy";

export function Badge({ tone = "gray", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  const tones: Record<Tone, string> = {
    blue: "bg-sky text-cobalt",
    green: "bg-mint text-[#11704f]",
    gray: "bg-[#f1f3f7] text-muted",
    red: "bg-[#fdeeee] text-[#a32b2b]",
    amber: "bg-[#fff4db] text-warning-text",
    navy: "bg-ink text-white",
  };
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold leading-4", tones[tone])}>
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full bg-[#eef2f8] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-full font-bold transition-colors",
            size === "sm" ? "px-3 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]",
            o.value === value ? "bg-surface text-cobalt shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx("flex flex-col gap-1", className)}>
      <span className="text-[12px] font-bold text-muted">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-10 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-bold text-ink outline-none focus:border-blue"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] font-bold text-muted">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-blue" : "bg-line-strong")}
      >
        <span
          className={cx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            checked ? "start-[18px]" : "start-0.5",
          )}
        />
      </button>
      <span>{label}</span>
    </label>
  );
}

/** Small (i) with a hover / focus hint. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <span
        tabIndex={0}
        aria-label={text}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-line-strong text-[10px] font-bold text-faint outline-none focus-visible:border-blue"
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full start-1/2 z-30 mb-2 hidden w-max max-w-[min(260px,70vw)] -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-[12px] font-normal leading-relaxed text-white shadow-lg group-focus-within:block group-hover:block rtl:translate-x-1/2"
      >
        {text}
      </span>
    </span>
  );
}

/** Chart container with a title and a chart/table toggle (the table is the accessible twin). */
export function ChartCard({
  title,
  subtitle,
  actions,
  table,
  children,
  showTableLabel,
  showChartLabel,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
  showTableLabel: string;
  showChartLabel: string;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={cx("p-5 sm:p-6", className)}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {actions}
            {table ? (
              <Button size="sm" variant="ghost" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
                {asTable ? showChartLabel : showTableLabel}
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mt-4">{asTable && table ? table : children}</div>
    </Card>
  );
}

export function SeriesKey({ color, label, kind = "line" }: { color: string; label: ReactNode; kind?: "line" | "rect" | "dot" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink-2">
      {kind === "line" ? (
        <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: color }} />
      ) : kind === "dot" ? (
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      ) : (
        <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      )}
      <span>{label}</span>
    </span>
  );
}

export function Legend({ items, kind = "line" }: { items: { key: string; color: string; label: ReactNode }[]; kind?: "line" | "rect" | "dot" }) {
  if (items.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <SeriesKey key={i.key} color={i.color} label={i.label} kind={kind} />
      ))}
    </div>
  );
}

export function DataTable({
  head,
  rows,
  className,
  stickyFirst = true,
}: {
  head: ReactNode[];
  rows: ReactNode[][];
  className?: string;
  stickyFirst?: boolean;
}) {
  return (
    <div className={cx("overflow-x-auto rounded-2xl border border-line", className)}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-[#f6f8fc] text-muted">
            {head.map((h, i) => (
              <th
                key={i}
                scope="col"
                className={cx(
                  "min-w-[72px] px-3 py-2.5 text-start align-bottom text-[12px] font-bold leading-snug",
                  i === 0 && stickyFirst && "sticky start-0 z-10 bg-[#f6f8fc]",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-line">
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className={cx(
                    "whitespace-nowrap px-3 py-2.5",
                    ci === 0 ? "font-bold text-ink" : "tnum text-ink-2",
                    ci === 0 && stickyFirst && "sticky start-0 z-10 bg-surface",
                  )}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Signed value with the direction carried by the sign and a text-safe colour. */
export function Signed({ value, text }: { value: number | null | undefined; text: string }) {
  const tone =
    value === null || value === undefined || !Number.isFinite(value) || value === 0
      ? "text-ink-2"
      : value > 0
        ? "text-good-text"
        : "text-critical";
  return <span className={cx("tnum ltr", tone)}>{text}</span>;
}
