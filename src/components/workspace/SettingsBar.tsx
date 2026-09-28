"use client";

import { useI18n } from "@/i18n/I18nProvider";
import type { IndexWindow, MarketData, Rebalance } from "@/lib/finance/types";
import { windowLength } from "@/lib/finance/window";
import { encodeShare } from "@/lib/share";
import { usePortfolioStore, type PeriodPreset } from "@/lib/store";
import { useUiStore } from "@/lib/ui-store";
import { UNIVERSE } from "@/lib/universe";
import { Button, Card, Select } from "../ui";
import { NumberField } from "./WeightInput";

const PERIODS: PeriodPreset[] = ["full", "y2021_2025", "since2022", "since2023", "y2020_2025", "last3y", "last1y", "ytd", "custom"];
const REBALANCE: Rebalance[] = ["daily", "monthly", "quarterly", "annually", "none"];

export function SettingsBar({ market, range }: { market: MarketData | null; range: IndexWindow | null }) {
  const { t, f } = useI18n();
  const settings = usePortfolioStore((s) => s.settings);
  const update = usePortfolioStore((s) => s.updateSettings);
  const notify = useUiStore((s) => s.notify);
  const { firstDate, lastDate } = UNIVERSE.source;

  const share = async () => {
    const { portfolios } = usePortfolioStore.getState();
    const token = encodeShare(
      portfolios.map((p) => ({ name: p.name, presetId: p.presetId, weights: p.weights })),
      settings,
    );
    const url = `${location.origin}${location.pathname}?s=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      notify(t.settings.shareCopied);
    } catch {
      prompt(t.share.button, url);
    }
  };

  const info =
    market && range
      ? t.settings.windowInfo(f.int(windowLength(range)), f.date(market.dates[range.startIdx]), f.date(market.dates[range.endIdx]))
      : null;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label={t.settings.period}
          value={settings.period}
          onChange={(period) =>
            update({
              period,
              ...(period === "custom" && !settings.customStart ? { customStart: "2021-01-01", customEnd: lastDate } : {}),
            })
          }
          options={PERIODS.map((p) => ({ value: p, label: t.settings.periods[p] }))}
          className="min-w-[170px]"
        />
        {settings.period === "custom" ? (
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-bold text-muted">{t.settings.start}</span>
              <input
                type="date"
                min={firstDate}
                max={settings.customEnd ?? lastDate}
                value={settings.customStart ?? firstDate}
                onChange={(e) => e.target.value && update({ customStart: e.target.value })}
                className="h-10 rounded-full border border-line-strong bg-surface px-3 text-[13px] font-bold text-ink outline-none focus:border-blue"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-bold text-muted">{t.settings.end}</span>
              <input
                type="date"
                min={settings.customStart ?? firstDate}
                max={lastDate}
                value={settings.customEnd ?? lastDate}
                onChange={(e) => e.target.value && update({ customEnd: e.target.value })}
                className="h-10 rounded-full border border-line-strong bg-surface px-3 text-[13px] font-bold text-ink outline-none focus:border-blue"
              />
            </label>
          </div>
        ) : null}
        <Select
          label={t.settings.rebalance}
          value={settings.rebalance}
          onChange={(rebalance) => update({ rebalance })}
          options={REBALANCE.map((r) => ({ value: r, label: t.settings.rebalanceOptions[r] }))}
          className="min-w-[180px]"
        />
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-bold text-muted">{t.settings.riskFree}</span>
          <NumberField value={settings.riskFree} onCommit={(v) => update({ riskFree: v })} label={t.settings.riskFree} min={-10} max={50} width="w-[5.5rem]" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-bold text-muted">{t.settings.amount}</span>
          <NumberField
            value={settings.amount}
            onCommit={(v) => v > 0 && update({ amount: v })}
            label={t.settings.amount}
            min={0}
            max={1e12}
            suffix={t.settings.currency}
            width="w-[10rem]"
            placeholder="100,000"
            grouped
          />
        </div>
        <div className="ms-auto">
          <Button variant="secondary" onClick={share}>
            {t.share.button}
          </Button>
        </div>
      </div>
      {info ? <p className="mt-3 text-[12.5px] font-bold text-muted">{info}</p> : null}
    </Card>
  );
}
