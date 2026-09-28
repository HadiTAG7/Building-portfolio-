"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_CONSTRAINTS, type ConstraintRule } from "@/lib/finance/constraints";
import type { Rebalance } from "@/lib/finance/types";
import { TICKERS, UNIVERSE } from "@/lib/universe";

export const MAX_PORTFOLIOS = 8;

export interface PortfolioDraft {
  id: string;
  /** User-given name; null shows the automatic label (preset name or "My portfolio n"). */
  name: string | null;
  presetId?: string;
  ordinal: number;
  /** Colour slot 0-7, fixed for the portfolio's lifetime so colours never repaint. */
  slot: number;
  /** Percent weights (0-100) keyed by ticker; zero weights are dropped. */
  weights: Record<string, number>;
}

export type PeriodPreset =
  | "full"
  | "y2021_2025"
  | "since2022"
  | "since2023"
  | "y2020_2025"
  | "last3y"
  | "last1y"
  | "ytd"
  | "custom";

export interface Settings {
  period: PeriodPreset;
  customStart: string | null;
  customEnd: string | null;
  rebalance: Rebalance;
  /** Annual risk-free rate in percent. */
  riskFree: number;
  amount: number;
  logScale: boolean;
}

export interface SharedPortfolio {
  name: string | null;
  presetId?: string;
  weights: Record<string, number>;
}

interface State {
  portfolios: PortfolioDraft[];
  activeId: string;
  nextOrdinal: number;
  settings: Settings;
  constraints: ConstraintRule[];
  setActive: (id: string) => void;
  addPortfolio: (init?: Partial<Pick<PortfolioDraft, "name" | "presetId" | "weights">>) => string | null;
  addPreset: (presetId: string) => string | null;
  duplicate: (id: string) => string | null;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  setWeight: (id: string, ticker: string, pct: number) => void;
  setWeights: (id: string, weights: Record<string, number>) => void;
  normalize: (id: string) => void;
  equalize: (id: string) => void;
  roundToWhole: (id: string) => void;
  clearWeights: (id: string) => void;
  replaceAll: (portfolios: SharedPortfolio[]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateConstraint: (id: string, patch: Partial<ConstraintRule>) => void;
  resetConstraints: () => void;
}

export const DEFAULT_SETTINGS: Settings = {
  period: "full",
  customStart: null,
  customEnd: null,
  rebalance: "daily",
  riskFree: 0,
  amount: 100_000,
  logScale: false,
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function cleanWeights(weights: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of TICKERS) {
    const v = weights[t];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[t] = Math.min(100, Math.round(v * 1e6) / 1e6);
  }
  return out;
}

function presetPercent(presetId: string): Record<string, number> | null {
  const preset = UNIVERSE.presets.find((p) => p.id === presetId);
  if (!preset) return null;
  const out: Record<string, number> = {};
  for (const [t, w] of Object.entries(preset.weights)) out[t] = Math.round(w * 1e8) / 1e6;
  return cleanWeights(out);
}

function freeSlot(portfolios: PortfolioDraft[]): number {
  const used = new Set(portfolios.map((p) => p.slot));
  for (let s = 0; s < MAX_PORTFOLIOS; s++) if (!used.has(s)) return s;
  return 0;
}

/** Largest-remainder rounding of percent weights to whole numbers summing to 100. */
function roundPercents(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights).filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (!total) return {};
  const scaled = entries.map(([t, v]) => [t, (v / total) * 100] as const);
  const floors = scaled.map(([t, v]) => [t, Math.floor(v), v - Math.floor(v)] as const);
  let missing = 100 - floors.reduce((a, [, f]) => a + f, 0);
  const order = [...floors].sort((a, b) => b[2] - a[2]);
  const out: Record<string, number> = Object.fromEntries(floors.map(([t, f]) => [t, f]));
  for (let k = 0; missing > 0 && k < order.length; k++, missing--) out[order[k][0]] += 1;
  return cleanWeights(out);
}

function initialPortfolio(): PortfolioDraft {
  return { id: uid(), name: null, presetId: "ug-1", ordinal: 1, slot: 0, weights: presetPercent("ug-1") ?? {} };
}

const first = initialPortfolio();

export const usePortfolioStore = create<State>()(
  persist(
    (set, get) => {
      const update = (id: string, fn: (p: PortfolioDraft) => PortfolioDraft) =>
        set((s) => ({ portfolios: s.portfolios.map((p) => (p.id === id ? fn(p) : p)) }));

      return {
        portfolios: [first],
        activeId: first.id,
        nextOrdinal: 1,
        settings: DEFAULT_SETTINGS,
        constraints: DEFAULT_CONSTRAINTS,

        setActive: (id) => set({ activeId: id }),

        addPortfolio: (init) => {
          const s = get();
          if (s.portfolios.length >= MAX_PORTFOLIOS) return null;
          const isCustom = !init?.presetId;
          const draft: PortfolioDraft = {
            id: uid(),
            name: init?.name ?? null,
            presetId: init?.presetId,
            ordinal: isCustom ? s.nextOrdinal : 0,
            slot: freeSlot(s.portfolios),
            weights: cleanWeights(init?.weights ?? {}),
          };
          set({
            portfolios: [...s.portfolios, draft],
            activeId: draft.id,
            nextOrdinal: isCustom ? s.nextOrdinal + 1 : s.nextOrdinal,
          });
          return draft.id;
        },

        addPreset: (presetId) => {
          const weights = presetPercent(presetId);
          if (!weights) return null;
          return get().addPortfolio({ presetId, weights });
        },

        duplicate: (id) => {
          const src = get().portfolios.find((p) => p.id === id);
          if (!src) return null;
          return get().addPortfolio({ weights: { ...src.weights } });
        },

        remove: (id) =>
          set((s) => {
            if (s.portfolios.length <= 1) return s;
            const portfolios = s.portfolios.filter((p) => p.id !== id);
            return { portfolios, activeId: s.activeId === id ? portfolios[0].id : s.activeId };
          }),

        rename: (id, name) => update(id, (p) => ({ ...p, name: name.trim() ? name.slice(0, 60) : null })),

        setWeight: (id, ticker, pct) =>
          update(id, (p) => ({ ...p, weights: cleanWeights({ ...p.weights, [ticker]: Math.max(0, Math.min(100, pct)) }) })),

        setWeights: (id, weights) => update(id, (p) => ({ ...p, weights: cleanWeights(weights) })),

        normalize: (id) =>
          update(id, (p) => {
            const total = Object.values(p.weights).reduce((a, b) => a + b, 0);
            if (!total) return p;
            const out: Record<string, number> = {};
            for (const [t, v] of Object.entries(p.weights)) out[t] = (v / total) * 100;
            return { ...p, weights: cleanWeights(out) };
          }),

        equalize: (id) =>
          update(id, (p) => {
            const held = Object.keys(p.weights);
            if (!held.length) return p;
            return { ...p, weights: roundPercents(Object.fromEntries(held.map((t) => [t, 100 / held.length]))) };
          }),

        roundToWhole: (id) => update(id, (p) => ({ ...p, weights: roundPercents(p.weights) })),

        clearWeights: (id) => update(id, (p) => ({ ...p, weights: {} })),

        replaceAll: (shared) =>
          set(() => {
            let ordinal = 1;
            const portfolios = shared.slice(0, MAX_PORTFOLIOS).map((sp, slot) => ({
              id: uid(),
              name: sp.name,
              presetId: sp.presetId && UNIVERSE.presets.some((p) => p.id === sp.presetId) ? sp.presetId : undefined,
              ordinal: sp.presetId ? 0 : ordinal++,
              slot,
              weights: cleanWeights(sp.weights),
            }));
            if (!portfolios.length) return {};
            return { portfolios, activeId: portfolios[0].id, nextOrdinal: ordinal };
          }),

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        updateConstraint: (id, patch) =>
          set((s) => ({ constraints: s.constraints.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

        resetConstraints: () => set({ constraints: DEFAULT_CONSTRAINTS }),
      };
    },
    {
      name: "portfolio-builder",
      version: 2,
      // v2 removed SOXX, DRAM, LIT, PAVE, AIPO, IYT, ARTY, BOTZ and the presets that held them.
      migrate: (persisted, version) => {
        const s = persisted as Partial<State>;
        if (version < 2 && s) {
          s.portfolios = (s.portfolios ?? []).map((p) => ({
            ...p,
            weights: cleanWeights(p.weights ?? {}),
            presetId: p.presetId && UNIVERSE.presets.some((x) => x.id === p.presetId) ? p.presetId : undefined,
          }));
          s.constraints = DEFAULT_CONSTRAINTS.map((d) => {
            const old = s.constraints?.find((c) => c.id === d.id);
            return old ? { ...d, limit: old.limit, enabled: old.enabled } : d;
          });
        }
        return s as State;
      },
      storage: createJSONStorage(() => localStorage),
      // Rehydrated manually after mount so the server HTML and first client render agree.
      skipHydration: true,
      partialize: (s) => ({
        portfolios: s.portfolios,
        activeId: s.activeId,
        nextOrdinal: s.nextOrdinal,
        settings: s.settings,
        constraints: s.constraints,
      }),
    },
  ),
);

export function totalWeight(p: Pick<PortfolioDraft, "weights">): number {
  return Object.values(p.weights).reduce((a, b) => a + b, 0);
}

/** Fractions aligned with TICKERS, as the engine expects. */
export function weightVector(p: Pick<PortfolioDraft, "weights">): number[] {
  return TICKERS.map((t) => (p.weights[t] ?? 0) / 100);
}
