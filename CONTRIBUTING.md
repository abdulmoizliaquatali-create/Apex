# Contributing to Apex ERP

Thanks for taking the time to contribute! This guide covers how to work on the
codebase, keep it consistent, and get your changes merged.

## Getting started

1. Fork the repo and clone your fork.
2. Install dependencies:

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. Start the dev servers (`./start.sh`) and confirm the app loads at
   http://localhost:5173 with the demo dataset.

## Code style

- TypeScript on the frontend — the production build (`npm run build`) runs
  `tsc -b` and must pass with no errors.
- ES modules everywhere; `import`/`export`, no CommonJS.
- No lint config is enforced, but keep it consistent with the surrounding code:
  two-space indent, single quotes, semicolons.
- Do not leave debug `console.log` statements or commented-out code.

## Frontend conventions

- **Never write an `/api` prefix in page/modal code.** `src/api.ts` already
  prepends `/api` to every request, so API calls should use prefixless paths
  (e.g. `api.post('/sales/123/convert')`). A doubled `/api/api/...` path is a
  regression.
- Add reusable UI to `src/components/ui.tsx`; keep page-specific JSX in the
  page component under `src/pages/`.
- Money is always formatted through the shared `fmt()` helper in `src/state.tsx`,
  which honors the current reporting base currency.

## Backend conventions

- Add endpoints to `server.js` (or a small focused module imported by it).
- Every document workflow change must keep the books balanced: debits = credits
  in every `journalEntries` row, and stock movements must match the inventory
  ledger.
- After changing `backend/seed.js` or `server.js`, restart the backend and reset
  the demo data (`POST /api/reset`) before verifying.

## Verifying changes

```bash
# frontend type-check + production build
cd frontend && npm run build

# backend up and books balance
curl http://localhost:3001/api/reports/balance-sheet
```

## Commit & PR workflow

1. Create a feature branch: `260816-feat-my-change` or similar.
2. Commit with a conventional-style message, e.g. `feat(sales): add draft status`
   or `fix(reports): correct cash-flow sign`.
3. Open a PR with the template; describe what changed and why, and how you
   verified it.

## Code of conduct

Be respectful and constructive. Keep discussions focused on the code.
