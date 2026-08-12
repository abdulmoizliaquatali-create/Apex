// fx.js — Automatic foreign-exchange rates.
//
// Fetches live rates (units per 1 USD) from a free public API and writes them
// back into db.currencies so every screen reports in current, trend-following
// FX rates. When the network is unavailable it falls back to a static snapshot
// so the app keeps working, flagging the rates as fallback.

import { store, round } from './store.js';

// Codes we care about. Everything is expressed in units per 1 USD because the
// internal ledger is stored in USD.
const CODES = ['USD', 'PKR', 'EUR', 'GBP', 'AED', 'CNY', 'VND'];

// Static snapshot used when the live API cannot be reached (per 1 USD).
const FALLBACK = { USD: 1, PKR: 282, EUR: 0.92, GBP: 0.79, AED: 3.67, CNY: 7.22, VND: 25400 };

const API_URL = 'https://open.er-api.com/v6/latest/USD';
const FETCH_TIMEOUT_MS = 12000;

let lastUpdate = null; // { updatedAt, source, fallback }

async function fetchLive() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.result !== 'success' || !data.rates) throw new Error('Unexpected API payload');
    const rates = {};
    for (const code of CODES) {
      if (typeof data.rates[code] === 'number' && data.rates[code] > 0) rates[code] = data.rates[code];
    }
    return { rates, source: 'open.er-api.com' };
  } finally {
    clearTimeout(timer);
  }
}

function applyRates(rates) {
  const db = store.db;
  let changed = 0;
  for (const cur of db.currencies) {
    if (cur.code === 'USD') continue; // USD is always 1.0000
    const r = rates[cur.code];
    if (typeof r === 'number' && r > 0 && Math.abs(cur.rate - r) > 0.000001) {
      cur.rate = round(r, 4);
      changed++;
    }
  }
  if (changed > 0) store.save();
  return changed;
}

function stampFx(source, fallback) {
  const db = store.db;
  db.meta = db.meta || {};
  const prev = db.meta.fx;
  const next = { updatedAt: new Date().toISOString(), source, fallback: !!fallback };
  db.meta.fx = next;
  lastUpdate = next;
  if (!prev || prev.source !== next.source || prev.fallback !== next.fallback) store.save();
}

// Refetch rates now. Never throws; returns a result describing what happened.
export async function refreshRates() {
  try {
    const { rates, source } = await fetchLive();
    const changed = applyRates(rates);
    stampFx(source, false);
    return { ok: true, source, changed, updatedAt: lastUpdate.updatedAt, fallback: false };
  } catch (e) {
    const changed = applyRates(FALLBACK);
    stampFx('fallback', true);
    return { ok: false, source: 'fallback', error: e.message, changed, updatedAt: lastUpdate.updatedAt, fallback: true };
  }
}

// Current rates + freshness metadata for the Currencies admin screen.
export function getRates() {
  const fx = store.db.meta?.fx || null;
  return {
    source: fx?.source || null,
    updatedAt: fx?.updatedAt || null,
    fallback: !!fx?.fallback,
    base: 'USD',
    rates: store.db.currencies
  };
}

// Refresh shortly after boot, then re-check on an interval.
export function startFxScheduler(intervalHours = 6) {
  const intervalMs = (Number(intervalHours) || 6) * 60 * 60 * 1000;
  const tick = async () => {
    try {
      const r = await refreshRates();
      console.log(`[fx] rates refreshed source=${r.source} ok=${r.ok} changed=${r.changed} updatedAt=${r.updatedAt}`);
    } catch (e) {
      console.error('[fx] refresh failed', e.message);
    }
  };
  setTimeout(tick, 5000);
  setInterval(tick, intervalMs);
}
