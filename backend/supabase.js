// =========================================================
// Supabase adapter — persistence layer for the Apex ERP.
//
// Uses Supabase's PostgREST REST API over plain fetch (no SDK dependency).
// Every table stores rows as { id, data: <record jsonb> }, mirroring the
// in-memory store, plus the singleton app_settings and sequences tables.
//
// Configuration (environment variables):
//   SUPABASE_URL                 e.g. https://abcd.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    service-role key (bypasses RLS)
//   SUPABASE_ANON_KEY            fallback only (RLS will block if used alone)
//
// When unconfigured the app falls back to the local JSON file store, so
// everything keeps working without Supabase.
// =========================================================

const COLLECTION_TABLES = [
  ['currencies', 'currencies'],
  ['accounts', 'accounts'],
  ['contacts', 'contacts'],
  ['products', 'products'],
  ['sales', 'sales'],
  ['purchases', 'purchases'],
  ['bankAccounts', 'bank_accounts'],
  ['bankTransactions', 'bank_transactions'],
  ['journalEntries', 'journal_entries']
];

const SETTINGS_TABLE = 'app_settings';
const SEQUENCES_TABLE = 'sequences';

export function isSupabaseConfigured() {
  return !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
}

export function supabaseConfig() {
  return {
    url: String(process.env.SUPABASE_URL).replace(/\/$/, ''),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  };
}

function authHeaders(cfg) {
  return {
    'Content-Type': 'application/json',
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`
  };
}

async function request(cfg, path, options = {}) {
  const res = await fetch(`${cfg.url}/rest/v1${path}`, { ...options, headers: { ...authHeaders(cfg), ...(options.headers || {}) } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`supabase ${options.method || 'GET'} ${path}: ${res.status} ${body.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : null;
}

export async function fetchCollection(cfg, table) {
  const rows = await request(cfg, `/${table}?select=id,data`);
  return (rows || []).map((r) => r.data);
}

export async function fetchCollectionIds(cfg, table) {
  const rows = await request(cfg, `/${table}?select=id`);
  return (rows || []).map((r) => r.id);
}

export async function upsertCollection(cfg, table, rows) {
  if (!rows.length) return;
  await request(cfg, `/${table}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows.map((row) => ({ id: row.id, data: row })))
  });
}

export async function deleteCollectionIds(cfg, table, ids) {
  if (!ids.length) return;
  await request(cfg, `/${table}?id=in.(${ids.map((id) => `"${id.replace(/"/g, '""')}"`).join(',')})`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });
}

export async function fetchSettings(cfg) {
  const rows = await request(cfg, `/${SETTINGS_TABLE}?id=eq.1&select=data`);
  return rows && rows[0] ? rows[0].data : {};
}

export async function upsertSettings(cfg, settings) {
  await request(cfg, `/${SETTINGS_TABLE}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ id: 1, data: settings }])
  });
}

export async function fetchSequences(cfg) {
  const rows = await request(cfg, `/${SEQUENCES_TABLE}?select=name,value`);
  const out = {};
  for (const r of rows || []) out[r.name] = r.value;
  return out;
}

export async function upsertSequences(cfg, sequences) {
  const entries = Object.entries(sequences || {}).map(([name, value]) => ({ name, value: Number(value) || 0 }));
  if (!entries.length) return;
  await request(cfg, `/${SEQUENCES_TABLE}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(entries)
  });
}

export async function deleteSequences(cfg, names) {
  if (!names.length) return;
  await request(cfg, `/${SEQUENCES_TABLE}?name=in.(${names.map((n) => `"${n.replace(/"/g, '""')}"`).join(',')})`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });
}

// Load the full database from Supabase into the in-memory shape used by
// store.js (mirrors Store.blank()).
export async function loadDatabase(cfg) {
  const db = {
    meta: { seededAt: null },
    settings: await fetchSettings(cfg),
    currencies: [], accounts: [], contacts: [], products: [],
    sales: [], purchases: [], bankAccounts: [], bankTransactions: [], journalEntries: [],
    sequences: await fetchSequences(cfg)
  };
  for (const [_, table] of COLLECTION_TABLES) {
    db[COLLECTION_TABLES.find(([c]) => c === table && c) ? table : table] = [];
  }
  // The mapping is stored as [collection, table]; fill each collection.
  for (const [collection, table] of COLLECTION_TABLES) {
    db[collection] = await fetchCollection(cfg, table);
  }
  return db;
}

// Write-through: upsert all local rows, delete any rows that were removed
// locally, and sync the settings singleton + sequences map. Returns a summary.
export async function syncDatabase(cfg, db) {
  const summary = { collections: {}, settings: 0, sequences: 0, deletes: 0 };
  for (const [collection, table] of COLLECTION_TABLES) {
    const rows = db[collection] || [];
    const localIds = rows.map((r) => r.id);
    const remoteIds = await fetchCollectionIds(cfg, table);
    const toDelete = remoteIds.filter((id) => !localIds.includes(id));
    await upsertCollection(cfg, table, rows);
    await deleteCollectionIds(cfg, table, toDelete);
    summary.collections[collection] = { rows: rows.length, deleted: toDelete.length };
    summary.deletes += toDelete.length;
  }
  await upsertSettings(cfg, db.settings || {});
  const remoteSeq = await fetchSequences(cfg);
  const localSeq = db.sequences || {};
  await upsertSequences(cfg, localSeq);
  const toDeleteSeq = Object.keys(remoteSeq).filter((k) => !(k in localSeq));
  await deleteSequences(cfg, toDeleteSeq);
  summary.sequences = Object.keys(localSeq).length;
  summary.settings = 1;
  return summary;
}
