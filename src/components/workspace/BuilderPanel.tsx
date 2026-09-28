"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { assetInfo, BUCKET_ORDER, type Bucket } from "@/data/assets";
import { useI18n } from "@/i18n/I18nProvider";
import { assetReliability } from "@/lib/finance/reliability";
import type { IndexWindow, MarketData } from "@/lib/finance/types";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { portfolioLabel, seriesColor } from "@/lib/portfolio-label";
import { MAX_PORTFOLIOS, totalWeight, usePortfolioStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui-store";
import { UNIVERSE } from "@/lib/universe";
import { Badge, Button, Card, cx, Switch } from "../ui";
import { NumberField } from "./WeightInput";

function PresetMenu({ disabled }: { disabled: boolean }) {
  const { t, f } = useI18n();
  const addPreset = usePortfolioStore((s) => s.addPreset);
  const addPortfolio = usePortfolioStore((s) => s.addPortfolio);
  const nextOrdinal = usePortfolioStore((s) => s.nextOrdinal);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groups = (["ultraGrowth", "growth"] as const).map((g) => ({
    group: g,
    items: UNIVERSE.presets.filter((p) => p.group === g),
  }));

  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="primary" disabled={disabled} onClick={() => setOpen((v) => !v)} aria-expanded={open} title={disabled ? t.builder.maxReached : undefined}>
        <span aria-hidden className="text-[16px] leading-none">+</span>
        {t.builder.add}
      </Button>
      {open ? (
        <div className="absolute end-0 z-30 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-2 shadow-xl">
          <button
            type="button"
            onClick={() => {
              addPortfolio();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-[14px] font-bold text-ink hover:bg-sky"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky text-cobalt">+</span>
            {t.builder.presetName.custom(nextOrdinal)}
          </button>
          <div className="my-1 border-t border-line" />
          <p className="px-3 pb-1 pt-2 text-[12px] font-bold text-muted">{t.builder.fromPreset}</p>
          <div className="max-h-[340px] overflow-y-auto">
            {groups.map(({ group, items }) => (
              <div key={group} className="py-1">
                <p className="px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-faint">{t.builder.presetGroups[group]}</p>
                {items.map((p) => {
                  const top = Object.entries(p.weights)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([tk, w]) => `${tk} ${f.int(w * 100)}`)
                    .join(" · ");
                  const sum = Object.values(p.weights).reduce((a, b) => a + b, 0);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        addPreset(p.id);
                        setOpen(false);
                      }}
                      className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-start hover:bg-sky"
                    >
                      <span className="flex items-center gap-2 text-[13.5px] font-bold text-ink">
                        {t.builder.presetName[group](p.index)}
                        {Math.abs(sum - 1) > 1e-6 ? <Badge tone="amber">{f.pct(sum, 0)}</Badge> : null}
                      </span>
                      <span className="ltr text-[11.5px] text-muted">{top}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TotalMeter({ total }: { total: number }) {
  const { t, f } = useI18n();
  const diff = total - 100;
  const ok = Math.abs(diff) < 0.005;
  const over = diff > 0.005;
  const fill = Math.min(100, total);
  return (
    <div className="rounded-2xl bg-[#f6f8fc] px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-bold text-muted">{t.builder.total}</span>
        <span className={cx("ltr text-[20px] font-extrabold", ok ? "text-ink" : over ? "text-critical" : "text-warning-text")}>
          {f.num(total, total % 1 ? 2 : 0)}%
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-2">
        <div
          className={cx("h-full rounded-full transition-[width]", ok ? "bg-grad-green" : over ? "bg-critical" : "bg-warning")}
          style={{ width: `${fill}%` }}
        />
      </div>
      <p className={cx("mt-1.5 text-[12px] font-bold", ok ? "text-[#11704f]" : over ? "text-critical" : "text-warning-text")}>
        {ok ? `✓ ${t.builder.totalOk}` : over ? `▲ ${t.builder.totalOver(f.pct(diff / 100, 1))}` : `▼ ${t.builder.totalUnder(f.pct(-diff / 100, 1))}`}
      </p>
    </div>
  );
}

export function BuilderPanel({ market, range }: { market: MarketData | null; range: IndexWindow | null }) {
  const { t, f } = useI18n();
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activeId = usePortfolioStore((s) => s.activeId);
  const setActive = usePortfolioStore((s) => s.setActive);
  const rename = usePortfolioStore((s) => s.rename);
  const duplicate = usePortfolioStore((s) => s.duplicate);
  const remove = usePortfolioStore((s) => s.remove);
  const setWeight = usePortfolioStore((s) => s.setWeight);
  const normalize = usePortfolioStore((s) => s.normalize);
  const equalize = usePortfolioStore((s) => s.equalize);
  const roundToWhole = usePortfolioStore((s) => s.roundToWhole);
  const clearWeights = usePortfolioStore((s) => s.clearWeights);
  const openSave = useUiStore((s) => s.openSave);

  const [query, setQuery] = useState("");
  const [onlyHeld, setOnlyHeld] = useState(false);
  const [shariahOnly, setShariahOnly] = useState(false);

  const active = portfolios.find((p) => p.id === activeId) ?? portfolios[0];
  const total = totalWeight(active);

  const quality = useMemo(() => {
    if (!market || !range) return null;
    return Object.fromEntries(UNIVERSE.assets.map((a) => [a.ticker, assetReliability(market.dates, range, a.inception)]));
  }, [market, range]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: { bucket: Bucket; assets: typeof UNIVERSE.assets }[] = [];
    for (const bucket of BUCKET_ORDER) {
      const assets = UNIVERSE.assets.filter((a) => {
        const info = assetInfo(a.ticker);
        if (info.bucket !== bucket) return false;
        if (onlyHeld && !(active.weights[a.ticker] > 0)) return false;
        if (shariahOnly && info.shariah !== "compliant") return false;
        if (!q) return true;
        return (
          a.ticker.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          info.classAr.includes(query.trim()) ||
          info.classEn.toLowerCase().includes(q)
        );
      });
      if (assets.length) out.push({ bucket, assets });
    }
    return out;
  }, [query, onlyHeld, shariahOnly, active.weights]);

  const isAr = t.dir === "rtl";

  return (
    <Card className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-extrabold text-ink">{t.builder.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{t.builder.subtitle}</p>
          </div>
          <PresetMenu disabled={portfolios.length >= MAX_PORTFOLIOS} />
        </div>

        <div role="tablist" aria-label={t.builder.title} className="mt-4 flex flex-wrap gap-2">
          {portfolios.map((p) => {
            const sel = p.id === active.id;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={sel}
                type="button"
                onClick={() => setActive(p.id)}
                className={cx(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-bold transition-colors",
                  sel ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-2 hover:border-blue",
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: seriesColor(p.slot) }} />
                {portfolioLabel(p, t)}
              </button>
            );
          })}
        </div>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-[12px] font-bold text-muted">{t.builder.nameLabel}</span>
            <input
              value={active.name ?? ""}
              placeholder={portfolioLabel({ ...active, name: null }, t)}
              onChange={(e) => rename(active.id, e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-[14px] font-bold text-ink outline-none placeholder:text-faint focus:border-blue"
            />
          </label>
          <TotalMeter total={total} />
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="soft" onClick={() => normalize(active.id)} disabled={!total || Math.abs(total - 100) < 0.005}>
              {t.builder.normalize}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => equalize(active.id)} disabled={!total}>
              {t.builder.equal}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => roundToWhole(active.id)} disabled={!total}>
              {t.builder.round}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => clearWeights(active.id)} disabled={!total}>
              {t.builder.clear}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
            <Button size="sm" variant="ghost" onClick={() => duplicate(active.id)} disabled={portfolios.length >= MAX_PORTFOLIOS}>
              {t.builder.duplicate}
            </Button>
            {isFirebaseConfigured ? (
              <Button size="sm" variant="ghost" onClick={() => openSave(active.id)} disabled={!total}>
                {t.library.save}
              </Button>
            ) : null}
            <Button size="sm" variant="danger" onClick={() => remove(active.id)} disabled={portfolios.length <= 1}>
              {t.builder.remove}
            </Button>
          </div>
        </div>
      </div>

      <div className="border-t border-line px-5 pb-6 pt-4 sm:px-6">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.builder.search}
          className="h-10 w-full rounded-full border border-line-strong bg-[#f8fafd] px-4 text-[14px] outline-none placeholder:text-faint focus:border-blue focus:bg-surface"
        />
        <div className="mt-3 flex flex-wrap gap-4">
          <Switch checked={onlyHeld} onChange={setOnlyHeld} label={t.builder.onlyHeld} />
          <Switch checked={shariahOnly} onChange={setShariahOnly} label={t.builder.shariahOnly} />
        </div>

        {grouped.length === 0 ? <p className="mt-6 text-center text-[13px] text-muted">{t.builder.empty}</p> : null}

        {grouped.map(({ bucket, assets }) => (
          <div key={bucket} className="mt-5">
            <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-faint">{t.builder.buckets[bucket]}</h3>
            <ul className="space-y-1.5">
              {assets.map((a) => {
                const info = assetInfo(a.ticker);
                const w = active.weights[a.ticker] ?? 0;
                const rel = quality?.[a.ticker];
                const qTone = !rel ? "gray" : rel.rating === "high" ? "green" : rel.rating === "medium" ? "blue" : "amber";
                const details = [
                  a.name,
                  a.inception && a.backcastUntil ? t.builder.inception(f.date(a.inception)) : null,
                  a.backcastUntil && info.proxy ? t.builder.backcast(isAr ? info.proxy.ar : info.proxy.en) : null,
                  a.dataFrom && a.dataFrom > UNIVERSE.source.firstDate ? t.builder.blankBefore(f.date(a.dataFrom)) : null,
                ]
                  .filter(Boolean)
                  .join("\n");
                return (
                  <li key={a.ticker} className={cx("rounded-2xl border px-3 py-2.5 transition-colors", w > 0 ? "border-blue/35 bg-sky/40" : "border-line bg-surface")}>
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1" title={details}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="ltr text-[14px] font-extrabold text-ink">{a.ticker}</span>
                          <span className="text-[12px] text-muted">{isAr ? info.classAr : info.classEn}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge
                            tone={info.shariah === "compliant" ? "green" : info.shariah === "nonCompliant" ? "red" : "gray"}
                            title={t.builder.shariahSource[info.shariahSource]}
                          >
                            {t.builder.shariah[info.shariah]}
                          </Badge>
                          {rel ? (
                            <Badge tone={qTone} title={details}>
                              {t.builder.quality[rel.rating]} · {f.pct(rel.actualShare, 0)}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <NumberField value={w} onCommit={(v) => setWeight(active.id, a.ticker, v)} label={t.builder.weightInput(a.ticker)} />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={w}
                      aria-label={t.builder.weightInput(a.ticker)}
                      onChange={(e) => setWeight(active.id, a.ticker, Number(e.target.value))}
                      className="weight-range mt-2.5 block w-full"
                      style={{ ["--fill" as string]: `${w}%` }}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
