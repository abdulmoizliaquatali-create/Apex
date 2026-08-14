-- =========================================================
-- Apex Gloves ERP — Supabase schema (Postgres)
-- Run this once in the Supabase SQL editor:
--   Dashboard → SQL Editor → New query → paste → Run.
-- The app reads/writes these tables through the backend service-role key.
-- =========================================================

-- Every record is stored as a primary key `id` plus a `data` JSONB blob that
-- mirrors the app's in-memory model exactly. This keeps the schema stable as
-- fields evolve and avoids a brittle column-per-field migration layer.
-- `users` additionally exposes an indexed `email` column so logins and unique
-- lookups stay fast in raw SQL.

create table if not exists app_settings (
  id integer primary key check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  data jsonb not null,
  email text generated always as (data->>'email') stored,
  updated_at timestamptz not null default now()
);
create unique index if not exists users_email_key on users (lower(email));

create table if not exists currencies (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists accounts (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists contacts (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists sales (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists purchases (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists bank_accounts (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists bank_transactions (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists journal_entries (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists sequences (
  name text primary key,
  value bigint not null default 1000,
  updated_at timestamptz not null default now()
);

-- ---------- updated_at trigger ----------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array[
    'app_settings','users','currencies','accounts','contacts','products',
    'sales','purchases','bank_accounts','bank_transactions','journal_entries','sequences'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated on %I', t, t);
    execute format(
      'create trigger trg_%I_updated before update on %I for each row execute function set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ---------- Row Level Security ----------
-- The backend authenticates with the service_role key, which bypasses RLS, so
-- no policies are required for the app. Enabling RLS here locks every table
-- down for the anon key (any public web client): without policies, anonymous
-- reads/writes are denied. Add policies below only if you later expose a
-- public PostgREST client.
alter table app_settings enable row level security;
alter table users enable row level security;
alter table currencies enable row level security;
alter table accounts enable row level security;
alter table contacts enable row level security;
alter table products enable row level security;
alter table sales enable row level security;
alter table purchases enable row level security;
alter table bank_accounts enable row level security;
alter table bank_transactions enable row level security;
alter table journal_entries enable row level security;
alter table sequences enable row level security;

-- ---------- Helpful indexes (raw SQL / analytics) ----------
create index if not exists sales_number_idx   on sales   ((data->>'number'));
create index if not exists sales_date_idx     on sales   ((data->>'date'));
create index if not exists sales_status_idx   on sales   ((data->>'status'));
create index if not exists purchases_number_idx on purchases ((data->>'number'));
create index if not exists purchases_date_idx on purchases ((data->>'date'));
create index if not exists contacts_name_idx  on contacts ((data->>'name'));
create index if not exists products_sku_idx   on products ((data->>'sku'));
create index if not exists products_category_idx on products ((data->>'category'));
create index if not exists journal_date_idx   on journal_entries ((data->>'date'));

-- Seed an empty settings row so the singleton upsert always has a target.
insert into app_settings (id, data) values (1, '{}'::jsonb)
on conflict (id) do nothing;
