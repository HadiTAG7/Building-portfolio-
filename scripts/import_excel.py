#!/usr/bin/env python3
"""Import the portfolio-allocation workbook into the app's data files.

Usage:
    pip install openpyxl
    python3 scripts/import_excel.py path/to/New_Portfolios_Allocation.xlsx

Reads the sheets the app depends on and writes:
    src/data/generated/universe.json   asset metadata, preset weights, dataset info (bundled)
    public/data/returns.<hash>.json    daily total returns per asset (fetched at runtime)

Only numeric data and neutral labels are exported. The workbook's free-text
commentary columns (portfolio notes / opinions) are deliberately NOT exported,
because the site is public.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:  # pragma: no cover - guidance for first-time use
    sys.exit("openpyxl is required: pip install openpyxl")

ROOT = Path(__file__).resolve().parent.parent
UNIVERSE_OUT = ROOT / "src" / "data" / "generated" / "universe.json"
RETURNS_DIR = ROOT / "public" / "data"

BACKCAST_FONT_RGB = "FF843C0C"  # orange-italic cells mark pre-inception estimates
DECIMALS = 10


def sheet(wb, name: str):
    """Find a sheet by name, ignoring surrounding whitespace (e.g. ' Growth')."""
    for ws in wb.worksheets:
        if ws.title.strip() == name.strip():
            return ws
    raise KeyError(f"Sheet not found: {name!r}")


def iso(d) -> str:
    if isinstance(d, dt.datetime):
        d = d.date()
    return d.isoformat()


def text(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def is_backcast_cell(cell) -> bool:
    f = cell.font
    return bool(f and f.i and f.color is not None and f.color.type == "rgb" and f.color.rgb == BACKCAST_FONT_RGB)


def read_returns(wb):
    ws = sheet(wb, "Daily Returns (Total)")
    tickers, names = [], []
    col = 2
    while True:
        t = text(ws.cell(1, col).value)
        if not t:
            break
        tickers.append(t)
        names.append(text(ws.cell(2, col).value))
        col += 1

    dates, series = [], {t: [] for t in tickers}
    backcast_last = {t: None for t in tickers}
    row = 3
    while True:
        d = ws.cell(row, 1).value
        if not isinstance(d, (dt.datetime, dt.date)):
            break
        dates.append(iso(d))
        for i, t in enumerate(tickers):
            cell = ws.cell(row, 2 + i)
            v = cell.value
            if v is None or v == "":
                series[t].append(None)
                continue
            if not isinstance(v, (int, float)):
                raise ValueError(f"Non-numeric return at {cell.coordinate}: {v!r}")
            series[t].append(round(float(v), DECIMALS) + 0.0)
            if is_backcast_cell(cell):
                backcast_last[t] = dates[-1]
        row += 1

    for a, b in zip(dates, dates[1:]):
        if a >= b:
            raise ValueError(f"Dates are not strictly increasing: {a} then {b}")
    return tickers, names, dates, series, backcast_last


def read_summary(wb):
    ws = sheet(wb, "Summary")
    out = {}
    row = 4
    while text(ws.cell(row, 1).value):
        t = text(ws.cell(row, 1).value)
        first = ws.cell(row, 3).value
        out[t] = {
            "name": text(ws.cell(row, 2).value),
            "inception": iso(first) if isinstance(first, (dt.datetime, dt.date)) else None,
            "note": text(ws.cell(row, 11).value),
        }
        row += 1
    return out


def read_methodology(wb):
    ws = sheet(wb, "Methodology")
    out = {}
    for row in range(6, ws.max_row + 1):
        t = text(ws.cell(row, 1).value)
        if not t or not t.isupper():
            continue
        corr = ws.cell(row, 7).value
        try:
            corr = float(corr)
        except (TypeError, ValueError):
            corr = None
        out[t] = {
            "classAr": text(ws.cell(row, 3).value),
            "statusAr": text(ws.cell(row, 4).value),
            "periodAr": text(ws.cell(row, 5).value),
            "proxyAr": text(ws.cell(row, 6).value),
            "correlation": corr,
            "qualityAr": text(ws.cell(row, 8).value),
        }
    return out


def read_portfolio_sheet(wb, name: str, tickers):
    ws = sheet(wb, name)
    # Columns follow the 'Daily Returns (Total)' order (row 4 references that sheet's header).
    classes = [text(ws.cell(5, 2 + i).value) for i in range(len(tickers))]
    notes = [text(ws.cell(3, 2 + i).value) for i in range(len(tickers))]
    portfolios = []
    row = 6
    while True:
        label = text(ws.cell(row, 1).value)
        if not label or not label.lower().startswith("portfolio"):
            break
        weights = {}
        for i, t in enumerate(tickers):
            v = ws.cell(row, 2 + i).value
            w = float(v) if isinstance(v, (int, float)) else 0.0
            if w:
                weights[t] = round(w, 6)
        total = sum(weights.values())
        if abs(total - 1) > 1e-6:
            print(f"warning: {name.strip()} {label} weights sum to {total:.4f}", file=sys.stderr)
        portfolios.append(weights)
        row += 1
    return classes, notes, portfolios


def main(path: str) -> None:
    src = Path(path)
    wb = openpyxl.load_workbook(src, data_only=True)
    tickers, names, dates, series, backcast_last = read_returns(wb)
    summary = read_summary(wb)
    methodology = read_methodology(wb)
    ug_classes, ug_notes, ug = read_portfolio_sheet(wb, "Ultra Growth", tickers)
    _, _, growth = read_portfolio_sheet(wb, "Growth", tickers)

    assets = []
    for i, t in enumerate(tickers):
        s = summary.get(t, {})
        m = methodology.get(t, {})
        values = series[t]
        first_idx = next((k for k, v in enumerate(values) if v is not None), None)
        inception = s.get("inception")
        if backcast_last[t] and inception and backcast_last[t] != inception:
            print(f"warning: {t} backcast styling ends {backcast_last[t]} but Summary inception is {inception}",
                  file=sys.stderr)
        assets.append({
            "ticker": t,
            "name": names[i] or s.get("name") or t,
            "classEn": ug_classes[i],
            "classAr": m.get("classAr"),
            "inception": inception or (dates[first_idx] if first_idx is not None else None),
            "backcastUntil": backcast_last[t],
            "dataFrom": dates[first_idx] if first_idx is not None else None,
            "summaryNote": s.get("note"),
            "methodology": m or None,
            "shariahNote": ug_notes[i],
        })

    presets = (
        [{"id": f"ug-{k + 1}", "group": "ultraGrowth", "index": k + 1, "weights": w} for k, w in enumerate(ug)]
        + [{"id": f"g-{k + 1}", "group": "growth", "index": k + 1, "weights": w} for k, w in enumerate(growth)]
    )

    returns_payload = json.dumps({"dates": dates, "returns": series}, separators=(",", ":"))
    digest = hashlib.sha256(returns_payload.encode()).hexdigest()[:10]
    RETURNS_DIR.mkdir(parents=True, exist_ok=True)
    for old in RETURNS_DIR.glob("returns.*.json"):
        old.unlink()
    returns_file = RETURNS_DIR / f"returns.{digest}.json"
    returns_file.write_text(returns_payload)

    universe = {
        "source": {
            "file": src.name,
            "importedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
            "firstDate": dates[0],
            "lastDate": dates[-1],
            "tradingDays": len(dates),
            "returnsFile": f"/data/{returns_file.name}",
            "hash": digest,
        },
        "assets": assets,
        "presets": presets,
    }
    UNIVERSE_OUT.parent.mkdir(parents=True, exist_ok=True)
    UNIVERSE_OUT.write_text(json.dumps(universe, ensure_ascii=False, indent=2) + "\n")

    print(f"{len(tickers)} assets, {len(dates)} days ({dates[0]} -> {dates[-1]}), "
          f"{len(presets)} presets -> {returns_file.relative_to(ROOT)} ({returns_file.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
