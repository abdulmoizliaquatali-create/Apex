# Supabase persistence for Apex ERP

This backend can persist all data in a free Supabase (Postgres) project instead
of the ephemeral JSON file (`backend/data/db.json`). Render's free tier wipes
the filesystem on redeploy/sleep, so enabling Supabase gives you durable cloud
storage with zero cost at demo scale.

## How it works

- The backend keeps its in-memory model exactly as before.
- When `SUPABASE_URL` and a key are configured, the backend **loads the whole
  database from Supabase at boot** and then **write-through syncs every
  mutation** (debounced ~400 ms) plus on graceful shutdown and via a manual
  endpoint.
- When Supabase is **not configured**, the app falls back to the local JSON
  file store — nothing breaks.

No SDK is used: it talks to Supabase's built-in **PostgREST** REST API over
`fetch`, so there are no extra dependencies.

## Setup (one time)

1. Create a free project at https://supabase.com (and note the database
   password).
2. In your project: **SQL Editor → New query**, paste the contents of
   [`migrations/0001_init.sql`](migrations/0001_init.sql), and press **Run**.
3. Grab the project credentials under **Project Settings → API**:
   - Project URL → `SUPABASE_URL`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`
4. Configure the backend:
   - Local dev: copy `backend/.env.example` to `backend/.env` and fill it in.
   - Render: add the same two variables under **Environment** on your service,
     then redeploy/restart.
5. Restart the backend. The first boot with an empty Supabase seeds the demo
   data and pushes it up.

## Security notes

- Use the **`service_role`** key **server-side only**. It bypasses row-level
  security — never expose it to the browser.
- Row-level security is enabled on every table with **no policies**, so the
  public `anon` key can read/write nothing. If you later build a public
  PostgREST client, add explicit policies.
- Passwords are stored as SHA-256 hashes inside `users.data.password_hash`.

## Schema

Each entity table is a primary key `id` plus a `data` JSONB blob that mirrors
the in-memory record exactly, so the schema stays stable as fields evolve.
`users` also exposes a generated, indexed `email` column for fast logins.

```mermaid
erDiagram
    app_settings ||--o| " " : "singleton row (id=1) stores settings/users"
    sequences {
        text name PK
        bigint value
    }
    users {
        text id PK
        jsonb data
        text email "generated from data->>'email'"
    }
    currencies { text id PK; jsonb data }
    accounts { text id PK; jsonb data }
    contacts { text id PK; jsonb data }
    products { text id PK; jsonb data }
    sales { text id PK; jsonb data }
    purchases { text id PK; jsonb data }
    bank_accounts { text id PK; jsonb data }
    bank_transactions { text id PK; jsonb data }
    journal_entries { text id PK; jsonb data }
```

Document JSON shapes (from the app):

- `sales.data` — quotations, sales orders, invoices, credit notes and customer
  receipts. Fields include `type, number, date, customerId, customerName,
  currency, fxRate, subtotal, tax, total, subtotalUsd, totalUsd, status,
  paidUsd, lines[]`.
- `purchases.data` — purchase orders, supplier bills and supplier payments.
  Fields include `type, number, date, supplierId, supplierName, currency,
  fxRate, freightUsd, customsUsd, totalUsd, status, paidUsd, lines[]`.
- `journal_entries.data` — double-entry postings: `date, memo, ref, docType,
  docId, lines[{accountId, debit?, credit?}]`.
- `app_settings.data` — company profile, base currency, preferences, modules,
  and the `users[]` array (roles, active flag, password hash).

## Admin operations

- Manual flush: `POST /api/sync` with an admin bearer token (also used to
  recover after a network blip).
- The backend also flushes on `SIGINT`/`SIGTERM`, so Render's shutdown hook
  pushes any pending writes.

## Table name mapping

| Collection (app)   | Supabase table      |
| ------------------ | ------------------- |
| `currencies`       | `currencies`        |
| `accounts`         | `accounts`          |
| `contacts`         | `contacts`          |
| `products`         | `products`          |
| `sales`            | `sales`             |
| `purchases`        | `purchases`         |
| `bankAccounts`     | `bank_accounts`     |
| `bankTransactions` | `bank_transactions` |
| `journalEntries`   | `journal_entries`   |
| `settings`         | `app_settings`      |
| `sequences`        | `sequences`         |
