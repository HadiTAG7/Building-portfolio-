"use client";

import { useMemo } from "react";
import { assetInfo } from "@/data/assets";
import { useI18n } from "@/i18n/I18nProvider";
import { INCEPTIONS } from "@/lib/analysis";
import { evaluateConstraints } from "@/lib/finance/constraints";
import { scenarioEstimate } from "@/lib/finance/optimizer";
import { assetStats, correlationMatrix } from "@/lib/finance/stats";
import type { IndexWindow, MarketData } from "@/lib/finance/types";
import { lowerBound } from "@/lib/finance/window";
import { usePortfolioStore } from "@/lib/store";
import { NumberField } from "../workspace/WeightInput";
import { Badge, Button, Card, CardHeader, cx, Switch } from "../ui";
import type { SeriesInfo } from "./ResultsPanel";

export function ConstraintsTab({ market, range, active }: { market: MarketData; range: IndexWindow; active: SeriesInfo | null }) {
  const { t, f } = useI18n();
  const rules = usePortfolioStore((s) => s.constraints);
  const updateConstraint = usePortfolioStore((s) => s.updateConstraint);
  const resetConstraints = usePortfolioStore((s) => s.resetConstraints);
  const riskFree = usePortfolioStore((s) => s.settings.riskFree) / 100;
  const isAr = t.dir === "rtl";

  const classes = useMemo(() => market.tickers.map((tk) => assetInfo(tk).classEn), [market]);
  const results = useMemo(
    () => (active ? evaluateConstraints(rules.map((r) => ({ ...r, enabled: true })), market.tickers, classes, active.a.weights) : []),
    [active, rules, market, classes],
  );

  const estimate = useMemo(() => {
    if (!active) return null;
    const idx = market.tickers.map((_, i) => i);
    const mu: (number | null)[] = [];
    const sigma: number[] = [];
    for (const i of idx) {
      const start = INCEPTIONS[i] ? Math.max(range.startIdx, lowerBound(market.dates, INCEPTIONS[i]!)) : range.startIdx;
      const s = assetStats(market.returns[i], { startIdx: start, endIdx: range.endIdx });
      mu.push(s.cagr);
      sigma.push(s.volatility ?? 0);
    }
    const corr = correlationMatrix(market, idx, range);
    return scenarioEstimate(active.a.weights, mu, sigma, corr, riskFree);
  }, [active, market, range, riskFree]);

  if (!active) return null;

  const subjectLabel = (id: string, subject?: string) => {
    if (!subject) return null;
    if (id === "maxClass") {
      const tk = market.tickers.find((x) => assetInfo(x).classEn === subject);
      return tk ? (isAr ? assetInfo(tk).classAr : subject) : subject;
    }
    return subject;
  };

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card className="p-5 sm:p-6">
        <CardHeader
          title={`${t.constraints.title} — ${active.label}`}
          subtitle={t.constraints.intro}
          actions={
            <Button size="sm" variant="ghost" onClick={resetConstraints}>
              ↺ {t.constraints.reset}
            </Button>
          }
        />
        <ul className="mt-5 space-y-2.5">
          {rules.map((rule) => {
            const res = results.find((r) => r.rule.id === rule.id);
            const pass = res?.pass ?? true;
            const pctLimit = rule.limit * 100;
            return (
              <li key={rule.id} className={cx("rounded-2xl border px-4 py-3", !rule.enabled ? "border-line bg-[#fafbfd] opacity-70" : pass ? "border-line bg-surface" : "border-critical/40 bg-[#fdf3f3]")}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-bold text-ink">{t.constraints.rules[rule.id as keyof typeof t.constraints.rules] ?? rule.id}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                      <span>
                        {t.constraints.value}: <span className="tnum ltr font-extrabold text-ink">{f.pct(res?.value, 1)}</span>
                      </span>
                      {res?.subject ? <span className="ltr">({subjectLabel(rule.id, res.subject)})</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span dir="ltr" className="text-[14px] font-bold text-muted">
                      {rule.kind === "groupMin" ? "≥" : rule.kind === "total" ? "=" : "≤"}
                    </span>
                    <NumberField
                      value={pctLimit}
                      onCommit={(v) => updateConstraint(rule.id, { limit: v / 100 })}
                      label={`${t.constraints.limit} ${rule.id}`}
                      width="w-[5rem]"
                    />
                    {rule.enabled ? (
                      <Badge tone={pass ? "green" : "red"}>{pass ? `✓ ${t.constraints.pass}` : `✕ ${t.constraints.fail}`}</Badge>
                    ) : null}
                    <Switch checked={rule.enabled} onChange={(v) => updateConstraint(rule.id, { enabled: v })} label={<span className="sr-only">{t.constraints.enabled}</span>} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card className="p-5 sm:p-6">
        <CardHeader title={t.constraints.estimateTitle} subtitle={t.constraints.estimateIntro} />
        {estimate ? (
          <dl className="mt-5 grid gap-3">
            {[
              [t.constraints.expectedReturn, f.pct(estimate.expectedReturn, 2)],
              [t.constraints.estVol, f.pct(estimate.volatility, 2)],
              [t.constraints.estSharpe, f.num(estimate.sharpe, 2)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 rounded-2xl bg-[#f6f8fc] px-4 py-3">
                <dt className="text-[13px] font-bold text-muted">{k}</dt>
                <dd className="tnum ltr text-[20px] font-extrabold text-ink">{v}</dd>
              </div>
            ))}
            <p className={cx("text-[12px] font-bold", estimate.missingReturn ? "text-warning-text" : "text-[#11704f]")}>
              {estimate.missingReturn ? `⚠ ${t.constraints.missingReturn}` : `✓ ${t.constraints.allOk}`}
            </p>
          </dl>
        ) : null}
      </Card>
    </div>
  );
}
