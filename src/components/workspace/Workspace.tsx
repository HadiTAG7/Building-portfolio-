"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { analysePortfolio, resolveAnalysisWindow } from "@/lib/analysis";
import type { MarketData } from "@/lib/finance/types";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { portfolioLabel, seriesColor } from "@/lib/portfolio-label";
import { decodeShare } from "@/lib/share";
import { usePortfolioStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui-store";
import { loadMarketData } from "@/lib/universe";
import { OptimizerPanel } from "../optimizer/OptimizerPanel";
import { ResultsPanel, type SeriesInfo } from "../results/ResultsPanel";
import { Button, Card } from "../ui";
import { BuilderPanel } from "./BuilderPanel";
import { LibraryLayer } from "./Library";
import { SettingsBar } from "./SettingsBar";

function Toast() {
  const toast = useUiStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div role="status" className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-[13.5px] font-bold text-white shadow-xl rtl:translate-x-1/2">
      {toast}
    </div>
  );
}

function LoadingCard({ message }: { message: string }) {
  return (
    <Card className="flex min-h-[420px] items-center justify-center p-10">
      <div className="flex items-center gap-3 text-[14px] font-bold text-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-2 border-t-blue" />
        {message}
      </div>
    </Card>
  );
}

export function Workspace() {
  const { t } = useI18n();
  const [hydrated, setHydrated] = useState(false);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Restore the saved workspace, then apply a shared link (?s=...) if there is one.
  useEffect(() => {
    let live = true;
    Promise.resolve(usePortfolioStore.persist.rehydrate()).then(() => {
      if (!live) return;
      const url = new URL(window.location.href);
      const token = url.searchParams.get("s");
      if (token) {
        const shared = decodeShare(token);
        if (shared) {
          const store = usePortfolioStore.getState();
          store.replaceAll(shared.portfolios);
          store.updateSettings(shared.settings);
          useUiStore.getState().notify(t.settings.sharedLoaded);
        }
        url.searchParams.delete("s");
        window.history.replaceState(null, "", url.toString());
      }
      setHydrated(true);
    });
    return () => {
      live = false;
    };
  }, [t.settings.sharedLoaded]);

  const load = useCallback(() => {
    setLoadError(false);
    loadMarketData()
      .then(setMarket)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    let live = true;
    loadMarketData()
      .then((m) => live && setMarket(m))
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, []);

  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activeId = usePortfolioStore((s) => s.activeId);
  const settings = usePortfolioStore((s) => s.settings);
  const deferredPortfolios = useDeferredValue(portfolios);
  const deferredSettings = useDeferredValue(settings);

  const range = useMemo(() => (market ? resolveAnalysisWindow(market, deferredSettings) : null), [market, deferredSettings]);

  const series: SeriesInfo[] = useMemo(() => {
    if (!market || !range) return [];
    return deferredPortfolios
      .filter((p) => Object.keys(p.weights).length > 0)
      .map((p) => ({
        id: p.id,
        label: portfolioLabel(p, t),
        color: seriesColor(p.slot),
        a: analysePortfolio(market, p, range, deferredSettings.rebalance, deferredSettings.riskFree / 100),
      }));
  }, [market, range, deferredPortfolios, deferredSettings.rebalance, deferredSettings.riskFree, t]);

  const active = series.find((s) => s.id === activeId) ?? null;
  const ready = hydrated && market && range;

  return (
    <>
      <div className="relative z-10 mx-auto -mt-8 max-w-[1440px] px-4 md:px-6">
        <div id="builder" className="grid items-start gap-6 lg:grid-cols-[minmax(340px,410px)_minmax(0,1fr)]">
          {hydrated ? <BuilderPanel market={market} range={range} /> : <LoadingCard message={t.common.loading} />}
          <div id="results" className="min-w-0 space-y-6">
            {hydrated ? <SettingsBar market={market} range={range} /> : null}
            {loadError ? (
              <Card className="flex flex-col items-center gap-4 p-10 text-center">
                <p className="text-[14px] font-bold text-critical">{t.common.loadError}</p>
                <Button variant="primary" onClick={load}>
                  {t.common.retry}
                </Button>
              </Card>
            ) : ready ? (
              <ResultsPanel market={market} range={range} series={series} active={active} />
            ) : (
              <LoadingCard message={t.common.loading} />
            )}
          </div>
        </div>
        {ready ? (
          <div className="mt-10">
            <OptimizerPanel market={market} range={range} />
          </div>
        ) : null}
      </div>
      {isFirebaseConfigured ? <LibraryLayer /> : null}
      <Toast />
    </>
  );
}
