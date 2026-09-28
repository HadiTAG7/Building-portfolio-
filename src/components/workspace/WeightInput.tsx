"use client";

import { useState } from "react";

/** Accept Arabic-Indic digits and the Arabic decimal separator as well as Latin input. */
export function parseNumber(text: string): number {
  let latin = text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٬/g, "")
    .trim();
  // "100,000" groups thousands; a lone comma ("2,5") is a decimal separator.
  latin = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(latin) ? latin.replace(/,/g, "") : latin.replace(/[٫,]/g, ".");
  return Number.parseFloat(latin.replace(/[^\d.\-]/g, ""));
}

function display(value: number, grouped = false): string {
  if (!value) return "";
  const v = Math.round(value * 100) / 100;
  return grouped ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(v);
}

export function NumberField({
  value,
  onCommit,
  label,
  min = 0,
  max = 100,
  suffix = "%",
  className = "",
  placeholder = "0",
  width = "w-[4.5rem]",
  grouped = false,
}: {
  value: number;
  onCommit: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  suffix?: string;
  className?: string;
  placeholder?: string;
  width?: string;
  /** Show thousands separators while not editing. */
  grouped?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label dir="ltr" className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{label}</span>
      <input
        inputMode="decimal"
        value={draft ?? display(value, grouped)}
        placeholder={placeholder}
        onFocus={(e) => {
          setDraft(display(value));
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parseNumber(e.target.value);
          if (e.target.value.trim() === "") onCommit(0);
          else if (Number.isFinite(v)) onCommit(Math.max(min, Math.min(max, v)));
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={`tnum h-9 ${width} rounded-xl border border-line-strong bg-surface ps-2 text-end text-[14px] font-bold text-ink outline-none transition-colors placeholder:text-faint focus:border-blue ${suffix.length > 1 ? "pe-10" : "pe-6"}`}
      />
      <span className="pointer-events-none absolute end-2 text-[12px] font-bold text-faint">{suffix}</span>
    </label>
  );
}
