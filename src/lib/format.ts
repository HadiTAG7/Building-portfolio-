import type { Locale } from "@/i18n/dictionaries";

const TAGS: Record<Locale, string> = {
  // Latin digits and the Gregorian calendar (ar-SA defaults to Hijri dates and Arabic-Indic digits).
  ar: "ar-SA-u-nu-latn-ca-gregory",
  en: "en-GB",
};

export interface Formatters {
  locale: Locale;
  pct: (x: number | null | undefined, digits?: number) => string;
  signedPct: (x: number | null | undefined, digits?: number) => string;
  num: (x: number | null | undefined, digits?: number) => string;
  int: (x: number | null | undefined) => string;
  money: (x: number | null | undefined) => string;
  compactMoney: (x: number) => string;
  date: (iso: string | null | undefined) => string;
  shortDate: (iso: string | null | undefined) => string;
  monthYear: (iso: string) => string;
}

const DASH = "—";

function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

const cache = new Map<Locale, Formatters>();

export function getFormatters(locale: Locale): Formatters {
  const hit = cache.get(locale);
  if (hit) return hit;
  const tag = TAGS[locale];
  const pctFmt = new Map<string, Intl.NumberFormat>();
  const numFmt = new Map<number, Intl.NumberFormat>();
  const pctFormatter = (digits: number, signed: boolean) => {
    const key = `${digits}${signed}`;
    let f = pctFmt.get(key);
    if (!f) {
      f = new Intl.NumberFormat(tag, {
        style: "percent",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        signDisplay: signed ? "exceptZero" : "auto",
      });
      pctFmt.set(key, f);
    }
    return f;
  };
  const numFormatter = (digits: number) => {
    let f = numFmt.get(digits);
    if (!f) {
      f = new Intl.NumberFormat(tag, { minimumFractionDigits: digits, maximumFractionDigits: digits });
      numFmt.set(digits, f);
    }
    return f;
  };
  const money = new Intl.NumberFormat(tag, { style: "currency", currency: "SAR", maximumFractionDigits: 0 });
  const compact = new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1 });
  const dateFmt = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const shortDateFmt = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const monthYearFmt = new Intl.DateTimeFormat(tag, { month: "short", year: "numeric", timeZone: "UTC" });
  const ok = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);

  const f: Formatters = {
    locale,
    pct: (x, digits = 1) => (ok(x) ? pctFormatter(digits, false).format(x) : DASH),
    signedPct: (x, digits = 1) => (ok(x) ? pctFormatter(digits, true).format(x) : DASH),
    num: (x, digits = 2) => (ok(x) ? numFormatter(digits).format(x) : DASH),
    int: (x) => (ok(x) ? numFormatter(0).format(x) : DASH),
    money: (x) => (ok(x) ? money.format(x) : DASH),
    compactMoney: (x) => compact.format(x),
    date: (iso) => (iso ? dateFmt.format(utc(iso)) : DASH),
    shortDate: (iso) => (iso ? shortDateFmt.format(utc(iso)) : DASH),
    monthYear: (iso) => monthYearFmt.format(utc(iso)),
  };
  cache.set(locale, f);
  return f;
}
