import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncDatabase } from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function round(n, d = 2) {
  const f = Math.pow(10, d);
  return Math.round((n + Number.EPSILON) * f) / f;
}

class Store {
  constructor() {
    this.db = null;
    this.load();
  }

  load() {
    if (fs.existsSync(DB_FILE)) {
      try {
        this.db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        return;
      } catch (e) {
        console.error('Failed to parse db.json, re-seeding', e.message);
      }
    }
    this.db = this.blank();
    this.save();
  }

  blank() {
    return {
      meta: { seededAt: null },
      settings: {},
      currencies: [],
      accounts: [],
      contacts: [],
      products: [],
      sales: [],
      purchases: [],
      bankAccounts: [],
      bankTransactions: [],
      journalEntries: [],
      sequences: {}
    };
  }

  save() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(this.db, null, 2));
    if (this._supabase) this._scheduleSync();
  }

  // ---- Supabase write-through ----

  enableSupabase(cfg) {
    this._supabase = cfg;
  }

  isSupabaseEnabled() {
    return !!this._supabase;
  }

  _scheduleSync() {
    this._syncPending = true;
    if (this._syncTimer) return;
    this._syncTimer = setTimeout(() => {
      this._syncTimer = null;
      if (!this._syncPending) return;
      this._syncPending = false;
      syncDatabase(this._supabase, this.db)
        .then((summary) => {
          const cols = Object.keys(summary.collections).length;
          console.log(`[supabase] synced ${cols} collections, ${summary.deletes} rows removed`);
        })
        .catch((e) => console.error('[supabase] sync failed:', e.message));
    }, 400);
  }

  // Force an immediate sync (used by /api/sync and graceful shutdown).
  async syncNow() {
    if (!this._supabase) return { enabled: false };
    if (this._syncTimer) { clearTimeout(this._syncTimer); this._syncTimer = null; }
    this._syncPending = false;
    return syncDatabase(this._supabase, this.db);
  }

  reset(seedFn) {
    this.db = this.blank();
    if (seedFn) seedFn(this.db);
    this.save();
  }

  collection(name) {
    if (!this.db[name]) this.db[name] = [];
    return this.db[name];
  }

  find(name, id) {
    return this.collection(name).find((r) => r.id === id);
  }

  insert(name, record) {
    this.collection(name).push(record);
    return record;
  }

  update(name, id, patch) {
    const idx = this.collection(name).findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.db[name][idx] = { ...this.db[name][idx], ...patch, id };
    return this.db[name][idx];
  }

  remove(name, id) {
    const idx = this.collection(name).findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.db[name].splice(idx, 1);
    return true;
  }

  nextNumber(name) {
    const seq = this.db.sequences[name] || 1000;
    this.db.sequences[name] = seq + 1;
    return seq;
  }

  insertJournal(entry) {
    this.collection('journalEntries').push({ ...entry, id: uid('je_') });
  }
}

export const store = new Store();
