# Apex Gloves International — Trading & Accounting Suite

A full-stack ERP for a Karachi-based glove importer/exporter. It covers the complete
order-to-cash and procure-to-pay cycles with double-entry bookkeeping, multi-currency
support, import shipments, inventory, banking, and financial reporting.

Demo data ships pre-seeded and is fully self-consistent: every journal entry is
double-entry, the balance sheet balances, and the inventory ledger matches on-hand stock.

## Stack

- **Frontend**: Vite + React + TypeScript (SPA, dark sidebar, responsive tables)
- **Backend**: Express (Node.js), JSON-file persistence at `backend/data/db.json`
- **Currency**: USD base; FX rates for PKR, CNY, VND, EUR, GBP, AED

## Features

- **Sales**: quotations → sales orders → invoices → credit notes → customer payments.
  Invoice tax line (configurable name/rate in Settings), overdue detection.
- **Purchasing**: purchase orders → supplier bills → supplier payments → import
  shipments view (goods value, freight, customs & duties for overseas suppliers).
- **Inventory**: product catalog with stock levels, reorder points, low-stock alerts,
  stock movement history, and inventory valuation. Stock adjustments post to the
  general ledger automatically.
- **Banking**: multi-account cash position, per-account running balance from the
  journal, bank transaction entry (expense/income), CSV export, backup export.
- **Accounting**: chart of accounts (create accounts with opening balances),
  journal & general ledger, double-entry posting for all documents.
- **Reports**: profit & loss, balance sheet, cash flow, inventory valuation,
  sales analysis (by customer/product), purchase analysis, AR/AP aging.
- **Contacts**: customers & suppliers with credit limits, per-contact statements.
- **Extras**: global search in the top bar, document duplication, CSV exports.

## Getting started

```bash
# install dependencies
cd backend && npm install
cd ../frontend && npm install
```

```bash
# run both services (frontend proxies /api to the backend)
./start.sh
```

- Backend API: http://localhost:3001
- Frontend app: http://localhost:5173

### Manual start

```bash
# terminal 1 — backend
cd backend && npm run dev

# terminal 2 — frontend (Vite dev server, /api proxied to :3001)
cd frontend && npm run dev
```

### Reset demo data

`POST /api/reset` re-seeds the database. Reset from the UI in Settings, or:

```bash
curl -X POST http://localhost:3001/api/reset -H 'Content-Type: application/json' -d '{}'
```

## Scripts

| Project  | Script          | Purpose                                  |
|----------|-----------------|------------------------------------------|
| frontend | `npm run dev`   | Vite dev server on :5173                 |
| frontend | `npm run build` | Type-check + production build            |
| backend  | `npm run dev`   | Express API on :3001 (auto JSON save)    |
| root     | `./start.sh`    | Start backend + frontend together        |

## Architecture

```
frontend/                  Vite + React + TS single-page app
  src/api.ts               fetch wrapper for /api
  src/state.tsx            DataProvider (settings, docs, journal, dashboard)
  src/components/          Layout, DocumentModal, DocDetail, ui kit
  src/pages/               Dashboard, Sales, Purchases, Products, Contacts,
                           Banking, Accounting, Reports, Settings
backend/
  server.js                Express routes, reports, generic CRUD, duplication
  ledger.js                double-entry posting (invoices, bills, payments…)
  seed.js                  full, self-consistent demo dataset
  store.js                 JSON persistence + sequences
  data/db.json             runtime database (gitignored)
```

### Data model

`COLLECTIONS = ['contacts','products','accounts','sales','purchases',
'bankAccounts','bankTransactions','journalEntries','currencies']`

Every posting creates a balanced `journalEntries` row (two or more lines, debits =
credits). Reports (P&L, balance sheet, cash flow) are derived from the journal and
document collections, so the books provably balance.

## Verification

```bash
# type-check + build the frontend

# after any seed/server change, restart backend and confirm:
curl http://localhost:3001/api/reports/balance-sheet
# assets == liabilities + equity + net profit
```
