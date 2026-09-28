"use client";

import { useMemo, useState } from "react";
import { assetInfo } from "@/data/assets";
import { useI18n } from "@/i18n/I18nProvider";
import { assetReliability } from "@/lib/finance/reliability";
import type { IndexWindow, MarketData } from "@/lib/finance/types";
import { UNIVERSE } from "@/lib/universe";
import { Badge, Card, CardHeader, DataTable, Segmented, Signed } from "../ui";
import type { SeriesInfo } from "./ResultsPanel";

export function QualityTab({ market, range, series }: { market: MarketData; range: IndexWindow; series: SeriesInfo[] }) {
  const { t, f } = useI18n();
  const [scope, setScope] = useState<"held" | "all">("held");
  const isAr = t.dir === "rtl";

  const assets = useMemo(() => {
    const held = new Set<number>();
    for (const s of series) s.a.weights.forEach((w, i) => w > 0 && held.add(i));
    return UNIVERSE.assets.filter((_, i) => scope === "all" || held.has(i));
  }, [scope, series]);

  const ratingTone = { high: "green", medium: "blue", low: "amber" } as const;
  const verdictTone = { reliable: "green", short: "amber", tooShort: "red", empty: "gray" } as const;

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <CardHeader title={t.quality.portfolioTitle} subtitle={t.quality.intro} />
        <DataTable
          className="mt-4"
          head={[t.common.portfolio, t.quality.commonStart, t.quality.actualDays, t.quality.fullCagr, t.quality.actualCagr, t.quality.effect, t.quality.columns.rating]}
          rows={series.map((s) => {
            const r = s.a.reliability;
            return [
              <span key="n" className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>,
              f.shortDate(r.commonActualStart),
              `${f.int(r.actualDays)} (${f.pct(r.actualShare, 0)})`,
              f.pct(r.fullCagr, 2),
              f.pct(r.actualCagr, 2),
              <Signed key="e" value={r.backcastEffect} text={f.signedPct(r.backcastEffect, 2)} />,
              <Badge key="v" tone={verdictTone[r.verdict]}>
                {t.quality.verdicts[r.verdict]}
              </Badge>,
            ];
          })}
        />
      </Card>
      <Card className="p-5 sm:p-6">
        <CardHeader
          title={t.quality.title}
          actions={
            <Segmented
              size="sm"
              value={scope}
              onChange={setScope}
              options={[
                { value: "held", label: t.optimizer.universeHeld },
                { value: "all", label: t.optimizer.universeAll },
              ]}
            />
          }
        />
        <DataTable
          className="mt-4"
          head={[
            t.quality.columns.fund,
            t.quality.columns.inception,
            t.quality.columns.actualDays,
            t.quality.columns.backcastDays,
            t.quality.columns.actualShare,
            t.quality.columns.rating,
            t.quality.columns.method,
            t.quality.columns.corr,
          ]}
          rows={assets.map((a) => {
            const r = assetReliability(market.dates, range, a.inception);
            const info = assetInfo(a.ticker);
            const blankBefore = a.dataFrom && a.dataFrom > UNIVERSE.source.firstDate;
            const method = a.backcastUntil ? (info.proxy ? (isAr ? info.proxy.ar : info.proxy.en) : t.common.none) : blankBefore ? t.quality.blank : t.quality.noMethod;
            return [
              <span key="t" className="flex flex-col">
                <span className="ltr">{a.ticker}</span>
                <span className="text-[11px] font-normal text-muted">{isAr ? info.classAr : info.classEn}</span>
              </span>,
              f.shortDate(a.inception),
              f.int(r.actualDays),
              f.int(r.backcastDays),
              f.pct(r.actualShare, 1),
              <Badge key="r" tone={ratingTone[r.rating]}>
                {t.quality.ratings[r.rating]}
              </Badge>,
              <span key="m" className="whitespace-normal text-[12px]">{method}</span>,
              a.backcastUntil && a.methodology?.correlation ? f.num(a.methodology.correlation, 2) : t.common.none,
            ];
          })}
        />
      </Card>
    </div>
  );
}
