import type { Dictionary } from "@/i18n/dictionaries";
import type { PortfolioDraft } from "@/lib/store";
import { UNIVERSE } from "@/lib/universe";

/** Categorical series colours (validated order; slot 1 is the brand blue). Keep in sync with globals.css. */
export const SERIES_COLORS = ["#0e80e7", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

export function seriesColor(slot: number): string {
  return SERIES_COLORS[slot % SERIES_COLORS.length];
}

export function portfolioLabel(p: Pick<PortfolioDraft, "name" | "presetId" | "ordinal">, t: Dictionary): string {
  if (p.name) return p.name;
  if (p.presetId) {
    const preset = UNIVERSE.presets.find((x) => x.id === p.presetId);
    if (preset) return t.builder.presetName[preset.group](preset.index);
  }
  return t.builder.presetName.custom(Math.max(1, p.ordinal));
}
