<div align="center">

# Apex Gloves International — Trading & Accounting Suite

**Full-stack ERP for a Karachi-based glove importer/exporter**

Order-to-cash and procure-to-pay cycles · double-entry bookkeeping · multi-currency ·
import shipments · inventory · banking · financial reporting

![Built with](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20TS-61dafb)
![Backend](https://img.shields.io/badge/Backend-Express%20%2F%20Node%2022-339933)
![Database](https://img.shields.io/badge/Database-JSON%20file%20persistence-8a97ab)
![Language](https://img.shields.io/badge/Base%20currency-PKR%20%E2%82%A8-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

Apex ERP is a complete, self-contained business management suite for a Pakistani
glove trading company. It covers the full **order-to-cash** and **procure-to-pay**
lifecycles backed by real double-entry accounting. Demo data ships pre-seeded and is
fully self-consistent: every journal entry balances, the balance sheet balances, and
the inventory ledger matches on-hand stock exactly.

## Highlights

- **Base currency PKR (₨)** — reporting is in Pakistani Rupees; USD/CNY/VND/EUR/GBP/AED
  transactions are stored internally in USD and converted for reporting. The base
  currency is switchable by an admin from Settings or the header currency switcher.
- **One-click document workflow** — quotation → sales order → invoice → payment, and
  purchase order → receive goods → bill → payment. Cancelling a document voids its
  payments, reverses the journal entries, and restores stock automatically.
- **Provably balanced books** — every posting creates a balanced `journalEntries`
  row; P&L, balance sheet, and cash flow are derived directly from the ledger.
- **PDF invoices & reports** — branded PDF export for every document and report,
  lazy-loaded so the main bundle stays lean.

## Stack

| Layer     | Tech                                                        |
|-----------|-------------------------------------------------------------|
| Frontend  | Vite + React 18 + TypeScript, React Router, recharts, jsPDF |
| Backend   | Express (Node.js), JSON-file persistence + optional Supabase |
| Data      | `backend/data/db.json` (gitignored) or Supabase Postgres    |
| Currency  | PKR base; FX rates for USD, CNY, VND, EUR, GBP, AED         |

## Features

- **Sales** — quotations → sales orders → invoices → credit notes → customer
  payments. Configurable tax line, overdue detection, one-click convert.
- **Purchasing** — purchase orders → receive goods → supplier bills → supplier
  payments, plus an import-shipments view (goods value, freight, customs & duties).
- **Inventory** — catalog with stock levels, reorder points, low-stock alerts,
  stock movement history, valuation, and GL-posting stock adjustments.
- **Banking** — multi-account cash position, per-account running balance from the
  journal, expense/income entries, CSV export, backup export.
- **Accounting** — chart of accounts with opening balances, journal & general
  ledger, automatic double-entry posting for all documents.
- **Reports** — profit & loss, balance sheet, cash flow, inventory valuation,
  sales analysis, purchase analysis, AR/AP aging — all exportable to PDF/CSV.
- **Contacts** — customers & suppliers with credit limits and per-contact statements.
- **Login & roles** — email/password sign-in with admin / accountant / viewer
  roles; admins manage users, modules and settings; viewers are read-only.
  Demo logins: `admin@apexgloves.com` / `admin123`,
  `accounts@apexgloves.com` / `accounts123`.
- **List power tools** — sortable columns, live filtering and pagination on
  every list, plus one-click browser printing (PDF export stays available).
- **Extras** — global search, document duplication, dark sidebar shell,
  animated loading states (count-up KPIs, skeleton loaders, page transitions).

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

`POST /api/reset` re-seeds the database from `backend/seed.js`. Reset from the UI
(Settings → Admin) or via:

```bash
curl -X POST http://localhost:3001/api/reset -H 'Content-Type: application/json' -d '{}'
```

## Deploy for free (Netlify + Render)

The app splits into two free services. The **frontend** is a static site on
Netlify; the **backend** runs on Render. They talk over the public internet with
CORS (already allow-listed in `backend/server.js`).

### 1. Backend → Render (Web Service)

1. Push this repository to GitHub.
2. Render dashboard → **New → Web Service** → connect the repo.
3. Set **Root Directory** to `backend`.
4. Build Command: `npm install` · Start Command: `npm start` (defaults).
5. Deploy. You'll get a URL like `https://<service>.onrender.com`.

The API lives under `/api` on that URL, e.g. `https://<service>.onrender.com/api/health`.

### 2. Frontend → Netlify (static site)

1. Netlify dashboard → **Add new site → Import an existing project** → connect
   the same GitHub repo.
2. Netlify reads the root `netlify.toml`, which sets:
   - Base directory: `frontend`
   - Build command: `npm ci && npm run build`
   - Publish directory: `dist`
3. The frontend routes API calls to your Render backend via
   `frontend/.env.production`:

   ```env
   VITE_API_URL=https://<your-render-service>.onrender.com/api
   ```

   Update that value to match your Render service name.

> **Free-tier caveats:** the Render instance sleeps after ~15 minutes of
> inactivity and wakes on the next request (first load ~30–50 s). The backend
> filesystem is ephemeral — demo data re-seeds on every redeploy. For **durable**
> data, point the backend at a hosted Postgres database:
> see [`backend/supabase/README.md`](backend/supabase/README.md) for the free
> Supabase setup (schema + `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`).

### Local development

Dev mode keeps using the Vite proxy: `VITE_API_URL` is unset, so `api.ts`
defaults to same-origin `/api`, and `vite.config.ts` proxies it to `:3001`.

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
  src/api.ts               fetch wrapper for /api (auto-prefixes requests)
  src/auth.tsx             AuthProvider — session, login/logout, roles
  src/state.tsx            DataProvider (settings, docs, journal, dashboard)
  src/components/          Layout, DocumentModal, DocDetail, ui kit, list kit
  src/pages/               Login, Dashboard, Sales, Purchases, Products,
                           Contacts, Banking, Accounting, Reports, Settings
  src/utils/pdf.ts         lazy-loaded jsPDF document/report exporter
backend/
  server.js                Express routes, reports, generic CRUD, duplication
  auth.js                  login tokens, password hashing, role checks
  env.js                   minimal .env loader (no dependency)
  supabase.js              PostgREST adapter — load + write-through sync
  ledger.js                double-entry posting (invoices, bills, payments…)
  seed.js                  full, self-consistent demo dataset
  store.js                 JSON persistence + sequences + Supabase sync hook
  data/db.json             runtime database (gitignored)
  supabase/                schema migration + setup docs
```

### Data model

```
COLLECTIONS = ['contacts','products','accounts','sales','purchases',
'bankAccounts','bankTransactions','journalEntries','currencies']
```

Every posting creates a balanced `journalEntries` row (two or more lines, debits =
credits). Reports (P&L, balance sheet, cash flow) are derived from the journal and
document collections, so the books provably balance.

### Currency model

- The ledger stores **USD** as its internal unit of account.
- Each currency has a `rate` vs USD (e.g. PKR 278, EUR 0.92).
- Documents are entered in their own currency and converted to USD on posting.
- The **reporting base** (`settings.baseCurrency`, default **PKR**) determines how
  every screen formats money via the shared `fmt()` helper.

## Verification

```bash
# type-check + build the frontend
cd frontend && npm run build

# after any seed/server change, restart backend and confirm books balance
curl http://localhost:3001/api/reports/balance-sheet
# assets == liabilities + equity + net profit
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
