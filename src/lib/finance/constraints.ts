export type ConstraintKind = "total" | "maxSingle" | "maxClass" | "groupMin" | "groupMax";

export interface ConstraintRule {
  id: string;
  kind: ConstraintKind;
  limit: number;
  /** Members for group rules. */
  tickers?: string[];
  enabled: boolean;
}

export interface ConstraintResult {
  rule: ConstraintRule;
  value: number;
  pass: boolean;
  /** Ticker or asset class that sets the value, for the max rules. */
  subject?: string;
}

/**
 * The Scenario sheet's editable checks, with its default limits. The workbook's
 * "synthetic" group was IBIT + DRAM + AIPO; DRAM and AIPO are no longer in the tool.
 */
export const DEFAULT_CONSTRAINTS: ConstraintRule[] = [
  { id: "total", kind: "total", limit: 1, enabled: true },
  { id: "maxSingle", kind: "maxSingle", limit: 0.45, enabled: true },
  { id: "maxClass", kind: "maxClass", limit: 0.45, enabled: true },
  { id: "core", kind: "groupMin", limit: 0.8, tickers: ["SPTE", "HLAL"], enabled: true },
  { id: "synthetic", kind: "groupMax", limit: 0.05, tickers: ["IBIT"], enabled: true },
];

const TOL = 1e-4;

export function evaluateConstraints(
  rules: readonly ConstraintRule[],
  tickers: readonly string[],
  classes: readonly string[],
  weights: ArrayLike<number>,
): ConstraintResult[] {
  const w = (i: number) => weights[i] ?? 0;
  return rules
    .filter((r) => r.enabled)
    .map((rule): ConstraintResult => {
      switch (rule.kind) {
        case "total": {
          let s = 0;
          for (let i = 0; i < tickers.length; i++) s += w(i);
          return { rule, value: s, pass: Math.abs(s - rule.limit) < 1e-3 };
        }
        case "maxSingle": {
          let best = 0;
          let subject: string | undefined;
          for (let i = 0; i < tickers.length; i++) {
            if (w(i) > best) {
              best = w(i);
              subject = tickers[i];
            }
          }
          return { rule, value: best, pass: best <= rule.limit + TOL, subject };
        }
        case "maxClass": {
          const byClass = new Map<string, number>();
          for (let i = 0; i < tickers.length; i++) byClass.set(classes[i], (byClass.get(classes[i]) ?? 0) + w(i));
          let best = 0;
          let subject: string | undefined;
          for (const [cls, s] of byClass) {
            if (s > best) {
              best = s;
              subject = cls;
            }
          }
          return { rule, value: best, pass: best <= rule.limit + TOL, subject };
        }
        case "groupMin":
        case "groupMax": {
          const members = new Set(rule.tickers ?? []);
          let s = 0;
          for (let i = 0; i < tickers.length; i++) if (members.has(tickers[i])) s += w(i);
          const pass = rule.kind === "groupMin" ? s >= rule.limit - TOL : s <= rule.limit + TOL;
          return { rule, value: s, pass };
        }
      }
    });
}
