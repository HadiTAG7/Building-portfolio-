"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { PortfolioAnalysis } from "@/lib/analysis";
import type { IndexWindow, MarketData } from "@/lib/finance/types";
import { Card, cx } from "../ui";
import { AllocationTab } from "./AllocationTab";
import { CompareTab } from "./CompareTab";
import { ConstraintsTab } from "./ConstraintsTab";
import { PerformanceTab } from "./PerformanceTab";
import { QualityTab } from "./QualityTab";
import { ReturnsTab } from "./ReturnsTab";
import { RiskTab } from "./RiskTab";

export interface SeriesInfo {
  id: string;
  label: string;
  color: string;
  a: PortfolioAnalysis;
}

const TABS = ["performance", "compare", "returns", "risk", "allocation", "quality", "constraints"] as const;
type Tab = (typeof TABS)[number];

export function ResultsPanel({
  market,
  range,
  series,
  active,
}: {
  market: MarketData;
  range: IndexWindow;
  series: SeriesInfo[];
  active: SeriesInfo | null;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("performance");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-extrabold text-ink">{t.results.title}</h2>
          <p className="mt-1 text-[13px] text-muted">{t.results.subtitle}</p>
        </div>
        {active ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-[12.5px] font-bold text-muted shadow-sm">
            {t.results.activeLabel}:
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: active.color }} />
            <span className="text-ink">{active.label}</span>
          </span>
        ) : null}
      </div>
      <div role="tablist" aria-label={t.results.title} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cx(
              "shrink-0 rounded-full px-4 py-2 text-[13.5px] font-bold transition-colors",
              tab === k ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink",
            )}
          >
            {t.results.tabs[k]}
          </button>
        ))}
      </div>
      {series.length === 0 ? (
        <Card className="p-10 text-center text-[14px] text-muted">{t.results.empty}</Card>
      ) : (
        <div role="tabpanel">
          {tab === "performance" ? <PerformanceTab series={series} active={active} /> : null}
          {tab === "compare" ? <CompareTab series={series} /> : null}
          {tab === "returns" ? <ReturnsTab series={series} active={active} /> : null}
          {tab === "risk" ? <RiskTab market={market} range={range} series={series} /> : null}
          {tab === "allocation" ? <AllocationTab market={market} range={range} active={active} /> : null}
          {tab === "quality" ? <QualityTab market={market} range={range} series={series} /> : null}
          {tab === "constraints" ? <ConstraintsTab market={market} range={range} active={active} /> : null}
        </div>
      )}
    </div>
  );
}
