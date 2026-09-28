import type { DateWindow, IndexWindow } from "./types";

/** First index whose date is >= `date` (ISO strings sort chronologically). */
export function lowerBound(dates: readonly string[], date: string): number {
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (dates[mid] < date) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index whose date is > `date`. */
export function upperBound(dates: readonly string[], date: string): number {
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (dates[mid] <= date) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Map an inclusive date window onto index bounds, like the workbook's `(V>=From)*(V<=To)` switch. */
export function resolveWindow(dates: readonly string[], window: DateWindow = {}): IndexWindow {
  const startIdx = window.start ? lowerBound(dates, window.start) : 0;
  const endIdx = window.end ? upperBound(dates, window.end) - 1 : dates.length - 1;
  return { startIdx, endIdx };
}

export function windowLength(window: IndexWindow): number {
  return Math.max(0, window.endIdx - window.startIdx + 1);
}
