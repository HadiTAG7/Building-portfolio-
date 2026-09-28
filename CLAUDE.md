@AGENTS.md

# Project notes

- Portfolio builder: Next.js 16 App Router + TypeScript + Tailwind v4 + Recharts + zustand. Routes `/ar` (default, RTL) and `/en`; `/` redirects to `/ar`.
- `src/lib/finance/*` mirrors the workbook formulas. `tests/engine.test.ts` checks it against `tests/fixtures/excel-recalc.json` (a LibreOffice recalculation of the workbook). Run `npm run check` before pushing.
- Data comes from the workbook via `npm run data:import -- <file.xlsx>` (python3 + openpyxl). Never commit `.xlsx` files: the repo is public and the workbook has internal notes. The free-text portfolio notes are intentionally not exported.
- Deploy with `npm run deploy` (see README). It reads `VERCEL_TOKEN` and `PORTFOLIO_FIREBASE_SERVICE_ACCOUNT` (the dedicated Firebase project for this site). Do not use the unrelated `FIREBASE_SERVICE_ACCOUNT` variable if it exists in the environment.
- Node's built-in fetch needs `NODE_USE_ENV_PROXY=1` behind a proxy; the `deploy` script sets it.
