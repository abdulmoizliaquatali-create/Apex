import './env.js';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { store, round, uid } from './store.js';
import { seed } from './seed.js';
import { refreshRates, getRates, startFxScheduler } from './fx.js';
import { convert, lineTotals, postInvoice, postCustomerPayment, postBill, postSupplierPayment, postBankTransaction, createSalesDoc, createPurchaseDoc, convertSalesDoc, receivePurchaseOrder, adjustStock, cancelDoc } from './ledger.js';
import { hashPassword, makeToken, verifyToken, bearerToken, safeUser, defaultPasswordFor } from './auth.js';
import { isSupabaseConfigured, supabaseConfig, loadDatabase } from './supabase.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

let db = store.db;

// Migration: ensure every user has a password hash so the login endpoint works
// for databases that were seeded before passwords existed.
function ensureUserPasswords() {
  const users = db.settings?.users;
  if (!Array.isArray(users)) return;
  let changed = false;
  for (const u of users) {
    if (!u.passwordHash) {
      u.passwordHash = hashPassword(defaultPasswordFor(u.role));
      console.log(`[auth] user ${u.email} had no password - default set to "${defaultPasswordFor(u.role)}"`);
      changed = true;
    }
  }
  if (changed) store.save();
}

// Boot is async so Supabase can provide the initial dataset when configured.
async function boot() {
  if (isSupabaseConfigured()) {
    const cfg = supabaseConfig();
    try {
      const remote = await loadDatabase(cfg);
      store.db = remote;
      store.enableSupabase(cfg);
      db = store.db;
      console.log(`[supabase] loaded ${db.currencies.length} currencies, ${db.sales.length} sales, ${db.purchases.length} purchases`);
    } catch (e) {
      console.error('[supabase] load failed, falling back to local store:', e.message);
    }
  }

  if (db.accounts.length === 0) {
    console.log('No data found - seeding...');
    seed();
  }

  ensureUserPasswords();
}

boot()
  .then(() => {
    const PORT = process.env.PORT || 3001;
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
      console.log('Serving built frontend from', distDir);
    } else {
      console.log('frontend/dist not found - running API-only (use Vite dev server for the UI)');
    }
    app.listen(PORT, () => console.log(`Apex backend listening on http://localhost:${PORT}`));
    startFxScheduler(process.env.FX_REFRESH_HOURS);
  })
  .catch((e) => {
    console.error('[boot] fatal:', e);
    process.exit(1);
  });

// ---------------- Auth ----------------
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const users = db.settings?.users || [];
  const user = users.find((u) => String(u.email || '').toLowerCase() === String(email || '').trim().toLowerCase());
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.active === false) {
    return res.status(403).json({ error: 'This account is deactivated. Contact an administrator.' });
  }
  const token = makeToken({ uid: user.id, role: user.role });
  res.json({ token, user: safeUser(user) });
});

app.get('/api/me', (req, res) => {
  const payload = verifyToken(bearerToken(req));
  if (!payload) return res.status(401).json({ error: 'Session expired. Please log in again.' });
  const user = (db.settings?.users || []).find((u) => u.id === payload.uid);
  if (!user) return res.status(401).json({ error: 'User no longer exists. Please log in again.' });
  if (user.active === false) return res.status(403).json({ error: 'This account is deactivated. Contact an administrator.' });
  res.json({ user: safeUser(user), token: makeToken({ uid: user.id, role: user.role }) });
});

// Mutating routes require a valid session. Viewers are read-only. The login
// endpoint itself is exempt; GET routes stay public (demo data is read-only).
app.use((req, res, next) => {
  const mutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  if (!req.path.startsWith('/api/') || !mutating || req.path === '/api/login') return next();
  const payload = verifyToken(bearerToken(req));
  if (!payload) return res.status(401).json({ error: 'Authentication required. Please log in again.' });
  if (payload.role === 'viewer') return res.status(403).json({ error: 'This account has read-only access.' });
  req.user = payload;
  next();
});

// ---------------- Supabase sync (manual flush, admin only) ----------------
app.post('/api/sync', requireAdmin, async (req, res) => {
  try {
    const summary = await store.syncNow();
    res.json({ ok: true, ...summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------- Bootstrap ----------------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Backup export contains the full database (including password hashes), so it
// is restricted to administrators.
app.get('/api/export', (req, res) => {
  const payload = verifyToken(bearerToken(req));
  if (!payload || payload.role !== 'admin') return res.status(403).json({ error: 'Administrator role required for backup export.' });
  res.json({ exportedAt: new Date().toISOString(), note: 'Apex Gloves - full data backup', db: db });
});

// Strip password hashes before sending settings to clients.
function sanitizeSettings(s) {
  if (!s || !Array.isArray(s.users)) return s;
  return { ...s, users: s.users.map((u) => { const { passwordHash, ...rest } = u; return rest; }) };
}

app.get('/api/bootstrap', (req, res) => {
  res.json({
    settings: sanitizeSettings(db.settings), currencies: db.currencies, accounts: db.accounts,
    contacts: db.contacts, products: db.products, bankAccounts: db.bankAccounts
  });
});

// ---------------- Generic CRUD (declared at the end so specific routes win) ----------------
const COLLECTIONS = ['contacts', 'products', 'accounts', 'sales', 'purchases', 'bankAccounts', 'bankTransactions', 'journalEntries', 'currencies'];

// ---------------- Workflow automation ----------------
app.post('/api/sales/:id/convert', (req, res) => {
  const { to } = req.body;
  try {
    const result = convertSalesDoc(db, req.params.id, to, req.body);
    store.save();
    res.status(201).json({ ...result.doc, convertedFrom: result.converted.number });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/purchases/:id/receive', (req, res) => {
  try {
    const result = receivePurchaseOrder(db, req.params.id, req.body);
    store.save();
    res.status(201).json({ ...result.bill, receivedFrom: result.received.number });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/sales/:id/status', (req, res) => {
  const doc = db.sales.find((x) => x.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'document not found' });
  const { status } = req.body;
  try {
    if (status === 'cancelled') cancelDoc(db, doc);
    else doc.status = status;
    store.save();
    res.json(doc);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/purchases/:id/status', (req, res) => {
  const doc = db.purchases.find((x) => x.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'document not found' });
  const { status } = req.body;
  try {
    if (status === 'cancelled') cancelDoc(db, doc);
    else doc.status = status;
    store.save();
    res.json(doc);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/products/:id/stock-adjust', (req, res) => {
  const product = db.products.find((x) => x.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'product not found' });
  const delta = Number(req.body.qty) || 0;
  try {
    const result = adjustStock(db, product, delta, req.body.memo);
    store.save();
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/restore', requireAdmin, (req, res) => {
  const data = req.body && req.body.db ? req.body.db : req.body;
  if (!data || typeof data !== 'object' || !Array.isArray(data.sales)) {
    return res.status(400).json({ error: 'invalid backup payload' });
  }
  const cleaned = store.blank();
  for (const key of ['settings', 'currencies', 'accounts', 'contacts', 'products', 'sales', 'purchases', 'bankAccounts', 'bankTransactions', 'journalEntries', 'sequences']) {
    if (Array.isArray(data[key]) || (key === 'settings' && typeof data[key] === 'object') || key === 'sequences') {
      cleaned[key] = data[key] || (key === 'sequences' ? {} : key === 'settings' ? {} : []);
    }
  }
  store.db = cleaned;
  store.save();
  db = store.db;
  res.json({ ok: true });
});

// ---------------- Sales / Purchases document creation ----------------
app.post('/api/sales', (req, res) => {
  const body = req.body;
  const customer = db.contacts.find((c) => c.id === body.customerId);
  if (!customer) return res.status(400).json({ error: 'customer required' });
  const lines = body.lines.map((l) => {
    const p = db.products.find((x) => x.id === l.productId);
    return { productId: l.productId, productName: p?.name || l.productName, sku: p?.sku || l.sku, qty: +l.qty, price: +l.price, unit: p?.unit || l.unit };
  });
  const common = { customer, lines, currency: body.currency || customer.currency, date: body.date || today(), taxRate: body.taxRate || 0, status: body.status };
  let doc;
  if (body.type === 'invoice') doc = postInvoice(db, { ...common, dueDate: body.dueDate });
  else if (body.type === 'quotation' || body.type === 'salesOrder' || body.type === 'creditNote') doc = createSalesDoc(db, body.type, { ...common, validUntil: body.validUntil, expectedDate: body.expectedDate });
  else return res.status(400).json({ error: 'unknown sales type' });
  store.save();
  res.status(201).json(doc);
});

app.post('/api/purchases', (req, res) => {
  const body = req.body;
  const supplier = db.contacts.find((c) => c.id === body.supplierId);
  if (!supplier) return res.status(400).json({ error: 'supplier required' });
  const lines = body.lines.map((l) => {
    const p = db.products.find((x) => x.id === l.productId);
    return { productId: l.productId, productName: p?.name || l.productName, sku: p?.sku || l.sku, qty: +l.qty, price: +l.price, unit: p?.unit || l.unit };
  });
  const common = { supplier, lines, currency: body.currency || supplier.currency, date: body.date || today(), status: body.status };
  let doc;
  if (body.type === 'bill') doc = postBill(db, { ...common, dueDate: body.dueDate, freightUsd: body.freightUsd || 0, customsUsd: body.customsUsd || 0 });
  else if (body.type === 'purchaseOrder') doc = createPurchaseDoc(db, 'purchaseOrder', { ...common, expectedDate: body.expectedDate });
  else return res.status(400).json({ error: 'unknown purchase type' });
  store.save();
  res.status(201).json(doc);
});

app.post('/api/payments/customer', (req, res) => {
  const { invoiceId, amount, currency, date, bankAccountId } = req.body;
  const invoice = db.sales.find((x) => x.id === invoiceId && x.type === 'invoice');
  if (!invoice) return res.status(400).json({ error: 'invoice not found' });
  const customer = db.contacts.find((c) => c.id === invoice.customerId);
  const rec = postCustomerPayment(db, { invoice, customer, amount: +amount, currency, date: date || today(), bankAccountId });
  store.save();
  res.status(201).json(rec);
});

app.post('/api/payments/supplier', (req, res) => {
  const { billId, amount, currency, date, bankAccountId } = req.body;
  const bill = db.purchases.find((x) => x.id === billId && x.type === 'bill');
  if (!bill) return res.status(400).json({ error: 'bill not found' });
  const supplier = db.contacts.find((c) => c.id === bill.supplierId);
  const pay = postSupplierPayment(db, { bill, supplier, amount: +amount, currency, date: date || today(), bankAccountId });
  store.save();
  res.status(201).json(pay);
});

app.post('/api/bank-transactions', (req, res) => {
  const tx = postBankTransaction(db, { ...req.body, date: req.body.date || today() });
  store.save();
  res.status(201).json(tx);
});

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Administrator role required for this action.' });
}

app.post('/api/settings', requireAdmin, (req, res) => {
  const body = { ...req.body };
  // Users are edited from the client without the password hash. Keep the
  // stored hash when it is not supplied, and hash a fresh one when the admin
  // sets a new password.
  if (Array.isArray(body.users)) {
    body.users = body.users.map((u) => {
      const { password, ...rest } = u;
      if (password) return { ...rest, passwordHash: hashPassword(password) };
      const existing = (db.settings?.users || []).find((x) => x.id === u.id);
      return { ...rest, ...(existing?.passwordHash ? { passwordHash: existing.passwordHash } : { passwordHash: hashPassword(defaultPasswordFor(u.role)) }) };
    });
  }
  db.settings = { ...db.settings, ...body };
  store.save();
  res.json(sanitizeSettings(db.settings));
});

// Change the reporting/base currency. Ledger stays in USD internally; this
// only changes the display base and the base flag on the currency table.
app.post('/api/settings/base-currency', (req, res) => {
  const { code } = req.body;
  const cur = db.currencies.find((c) => c.code === code);
  if (!cur) return res.status(400).json({ error: `unknown currency ${code}` });
  db.settings.baseCurrency = code;
  for (const c of db.currencies) c.base = c.code === code;
  db.settings.preferences = { ...(db.settings.preferences || {}), defaultCurrency: code };
  store.save();
  res.json({ ok: true, baseCurrency: code, currencies: db.currencies });
});

app.post('/api/accounts', (req, res) => {
  const { code, name, type, category, currency, opening = 0 } = req.body;
  if (!code || !name || !type) return res.status(400).json({ error: 'code, name and type required' });
  const account = { id: uid('acct_'), code: String(code), name, type, category: category || 'General', ...(currency ? { currency } : {}) };
  if (db.accounts.find((a) => a.code === account.code)) return res.status(400).json({ error: `account code ${account.code} already exists` });
  db.accounts.push(account);
  const bal = Math.abs(Number(opening) || 0);
  if (bal > 0 && ['asset', 'liability', 'equity'].includes(type)) {
    const isAsset = type === 'asset';
    store.insertJournal({
      date: today(), memo: `Opening balance - ${name}`, ref: account.code, docType: 'opening', docId: account.id,
      lines: isAsset
        ? [{ accountId: account.id, debit: bal }, { accountId: 'retained', credit: bal }]
        : [{ accountId: 'retained', debit: bal }, { accountId: account.id, credit: bal }]
    });
  }
  store.save();
  res.status(201).json(account);
});

app.post('/api/reset', requireAdmin, (req, res) => {
  store.reset(seed);
  db = store.db;
  res.json({ ok: true });
});

// ---------------- Document duplication ----------------
app.post('/api/sales/:id/duplicate', (req, res) => {
  const src = db.sales.find((x) => x.id === req.params.id);
  if (!src) return res.status(404).json({ error: 'document not found' });
  const customer = db.contacts.find((c) => c.id === src.customerId);
  const lines = src.lines || [];
  const date = today();
  let doc;
  if (src.type === 'invoice') {
    doc = postInvoice(db, { customer, lines, currency: src.currency, date, taxRate: (src.subtotal ? (src.tax || 0) / src.subtotal : 0) });
  } else if (src.type === 'creditNote') {
    doc = createSalesDoc(db, 'creditNote', { customer, lines, currency: src.currency, date });
  } else if (src.type === 'salesOrder') {
    doc = createSalesDoc(db, 'salesOrder', { customer, lines, currency: src.currency, date });
  } else {
    doc = createSalesDoc(db, 'quotation', { customer, lines, currency: src.currency, date });
  }
  store.save();
  res.status(201).json(doc);
});

app.post('/api/purchases/:id/duplicate', (req, res) => {
  const src = db.purchases.find((x) => x.id === req.params.id);
  if (!src) return res.status(404).json({ error: 'document not found' });
  const supplier = db.contacts.find((c) => c.id === src.supplierId);
  const lines = src.lines || [];
  const date = today();
  let doc;
  if (src.type === 'bill') {
    doc = postBill(db, { supplier, lines, currency: src.currency, date, freightUsd: src.freightUsd || 0, customsUsd: src.customsUsd || 0 });
  } else {
    doc = createPurchaseDoc(db, 'purchaseOrder', { supplier, lines, currency: src.currency, date });
  }
  store.save();
  res.status(201).json(doc);
});

// ---------------- Reports ----------------
function accountBalances(asOf) {
  const bal = {};
  for (const a of db.accounts) bal[a.id] = 0;
  for (const je of db.journalEntries) {
    if (asOf && je.date > asOf) continue;
    for (const l of je.lines) bal[l.accountId] = round((bal[l.accountId] || 0) + (l.debit || 0) - (l.credit || 0));
  }
  return bal;
}

app.get('/api/reports/profit-loss', (req, res) => {
  const { from = '2026-01-01', to = today() } = req.query;
  const bal = accountBalances();
  const rows = [];
  let total = 0;
  for (const a of db.accounts) {
    if (a.type !== 'income' && a.type !== 'expense') continue;
    let amount = 0;
    for (const je of db.journalEntries) {
      if (je.date < from || je.date > to) continue;
      for (const l of je.lines) {
        if (l.accountId !== a.id) continue;
        const delta = (l.credit || 0) - (l.debit || 0);
        amount += a.type === 'expense' ? -delta : delta;
      }
    }
    if (a.contra) amount = -amount;
    if (amount !== 0) rows.push({ accountId: a.id, code: a.code, name: a.name, type: a.type, category: a.category, amount: round(amount) });
    if (a.type === 'expense') total -= amount;
    else total += amount;
  }
  rows.sort((x, y) => x.code.localeCompare(y.code));
  const income = rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const expense = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  res.json({ from, to, rows, income: round(income), expense: round(expense), netProfit: round(income - expense) });
});

app.get('/api/reports/balance-sheet', (req, res) => {
  const asOf = req.query.asOf || today();
  const bal = accountBalances(asOf);
  const types = ['asset', 'liability', 'equity'];
  const sign = (t) => (t === 'asset' ? 1 : -1);
  const byType = {};
  for (const t of types) byType[t] = db.accounts.filter((a) => a.type === t).map((a) => ({ accountId: a.id, code: a.code, name: a.name, category: a.category, amount: round((bal[a.id] || 0) * sign(t)) })).filter((r) => r.amount !== 0);
  const assets = byType.asset.reduce((s, r) => s + r.amount, 0);
  const liabilities = byType.liability.reduce((s, r) => s + r.amount, 0);
  const equity = byType.equity.reduce((s, r) => s + r.amount, 0);
  const netProfit = profitToDate(asOf);
  res.json({ asOf, assets, liabilities, equity, netProfit, byType, balanced: round(assets - liabilities - equity - netProfit) === 0 });
});

function profitToDate(asOf) {
  let income = 0;
  let expense = 0;
  for (const a of db.accounts) {
    if (a.type !== 'income' && a.type !== 'expense') continue;
    let amount = 0;
    for (const je of db.journalEntries) {
      if (je.date > asOf) continue;
      for (const l of je.lines) {
        if (l.accountId !== a.id) continue;
        const delta = (l.credit || 0) - (l.debit || 0);
        amount += a.type === 'expense' ? -delta : delta;
      }
    }
    if (a.contra) amount = -amount;
    if (a.type === 'expense') expense += amount;
    else income += amount;
  }
  return round(income - expense);
}

app.get('/api/reports/cash-flow', (req, res) => {
  const { from = '2026-01-01', to = today() } = req.query;
  const bankSet = new Set(db.bankAccounts.map((b) => b.accountId));
  const categories = { operating: 0, investing: 0, financing: 0 };
  let inflow = 0;
  let outflow = 0;
  for (const je of db.journalEntries) {
    if (je.date < from || je.date > to) continue;
    for (const l of je.lines) {
      if (!bankSet.has(l.accountId)) continue;
      const amount = (l.debit || 0) - (l.credit || 0);
      if (amount > 0) inflow += amount;
      else outflow += -amount;
      const other = je.lines.find((x) => x.accountId !== l.accountId);
      const cat = other && other.accountId === 'equity' ? 'financing' : 'operating';
      categories[cat] += amount;
    }
  }
  res.json({
    from, to,
    inflow: round(inflow), outflow: round(outflow), net: round(inflow - outflow),
    categories: { operating: round(categories.operating), investing: round(categories.investing), financing: round(categories.financing) }
  });
});

app.get('/api/reports/inventory-valuation', (req, res) => {
  const rows = db.products.map((p) => ({ ...p, value: round(p.qty * p.cost), retailValue: round(p.qty * p.price) }));
  res.json({ rows, total: round(rows.reduce((s, r) => s + r.value, 0)), totalRetail: round(rows.reduce((s, r) => s + r.retailValue, 0)) });
});

app.get('/api/reports/sales-analysis', (req, res) => {
  const { from = '2026-01-01', to = today(), groupBy = 'customer' } = req.query;
  const invs = db.sales.filter((x) => x.type === 'invoice' && x.date >= from && x.date <= to);
  const map = {};
  for (const inv of invs) {
    const key = groupBy === 'product' ? inv.lines.map((l) => l.productName).join(' + ') : inv.customerName;
    const bucket = map[key] || (map[key] = { name: key, count: 0, revenue: 0, units: 0 });
    bucket.count += 1;
    bucket.revenue += inv.totalUsd;
    for (const l of inv.lines) bucket.units += l.qty;
  }
  const rows = Object.values(map).sort((a, b) => b.revenue - a.revenue);
  res.json({ from, to, groupBy, rows, total: round(rows.reduce((s, r) => s + r.revenue, 0)) });
});

app.get('/api/reports/purchase-analysis', (req, res) => {
  const { from = '2026-01-01', to = today() } = req.query;
  const bills = db.purchases.filter((x) => x.type === 'bill' && x.date >= from && x.date <= to);
  const map = {};
  for (const b of bills) {
    const bucket = map[b.supplierName] || (map[b.supplierName] = { name: b.supplierName, count: 0, total: 0 });
    bucket.count += 1;
    bucket.total += b.totalUsd;
  }
  const rows = Object.values(map).sort((a, b) => b.total - a.total);
  res.json({ from, to, rows, total: round(rows.reduce((s, r) => s + r.total, 0)) });
});

app.get('/api/reports/aging', (req, res) => {
  const buckets = (kind) => {
    const docs = kind === 'ar' ? db.sales.filter((x) => x.type === 'invoice') : db.purchases.filter((x) => x.type === 'bill');
    const result = [];
    for (const d of docs) {
      const outstanding = d.totalUsd - d.paidUsd;
      if (outstanding <= 0) continue;
      const ageDays = Math.max(0, Math.floor((Date.now() - new Date(d.dueDate + 'T12:00:00Z').getTime()) / 86400000));
      const bucket = ageDays <= 0 ? 'current' : ageDays <= 30 ? '0-30' : ageDays <= 60 ? '31-60' : ageDays <= 90 ? '61-90' : '90+';
      result.push({ name: kind === 'ar' ? d.customerName : d.supplierName, docNumber: d.number, dueDate: d.dueDate, outstanding: round(outstanding), bucket, kind });
    }
    return result;
  };
  const ar = buckets('ar');
  const ap = buckets('ap');
  const bucketize = (list) => {
    const out = { current: 0, '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    for (const r of list) out[r.bucket] = round((out[r.bucket] || 0) + r.outstanding);
    return out;
  };
  res.json({ ar, ap, arBuckets: bucketize(ar), apBuckets: bucketize(ap), arTotal: round(ar.reduce((s, r) => s + r.outstanding, 0)), apTotal: round(ap.reduce((s, r) => s + r.outstanding, 0)) });
});

app.get('/api/reports/currency', (req, res) => {
  res.json({ currencies: db.currencies });
});

// ---------------- Auto FX rates ----------------
app.get('/api/currencies/rates', (req, res) => {
  res.json(getRates());
});

app.post('/api/currencies/rates/refresh', async (req, res) => {
  try {
    const result = await refreshRates();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboard', (req, res) => {
  const month = today().slice(0, 7);
  const invs = db.sales.filter((x) => x.type === 'invoice');
  const monthInvs = invs.filter((x) => x.date.slice(0, 7) === month);
  const bills = db.purchases.filter((x) => x.type === 'bill');
  const monthBills = bills.filter((x) => x.date.slice(0, 7) === month);
  const monthRevenue = monthInvs.reduce((s, x) => s + x.totalUsd, 0);
  const monthExpense = monthBills.reduce((s, x) => s + x.totalUsd, 0);

  const bal = accountBalances();
  const arOpen = invs.reduce((s, x) => s + (x.totalUsd - x.paidUsd), 0);
  const apOpen = bills.reduce((s, x) => s + (x.totalUsd - x.paidUsd), 0);
  const bankIds = db.bankAccounts.map((b) => b.accountId);
  const cash = round(bankIds.reduce((s, id) => s + (bal[id] || 0), 0));
  const inventory = round(bal.inventory);
  const invValue = db.products.reduce((s, p) => s + p.qty * p.cost, 0);

  // revenue by month for chart (last 7 months with data, dynamic)
  const monthSet = new Set([...invs, ...bills].map((x) => x.date.slice(0, 7)));
  const months = [...monthSet].sort();
  const labels = months.length ? months.slice(-7) : [today().slice(0, 7)];
  const revenueSeries = labels.map((m) => round(invs.filter((x) => x.date.slice(0, 7) === m).reduce((s, x) => s + x.totalUsd, 0)));
  const expenseSeries = labels.map((m) => round(bills.filter((x) => x.date.slice(0, 7) === m).reduce((s, x) => s + x.totalUsd, 0)));

  const lowStock = db.products.filter((p) => p.qty <= p.reorder);

  // recent transactions
  const recent = db.journalEntries.slice(-12).reverse().map((je) => ({ id: je.id, date: je.date, memo: je.memo, ref: je.ref, amount: round(je.lines.reduce((s, l) => s + (l.debit || 0), 0)) }));

  const invByCategory = {};
  for (const inv of invs) {
    for (const l of inv.lines) {
      const p = db.products.find((x) => x.id === l.productId);
      const cat = p ? p.category : 'Other';
      invByCategory[cat] = round((invByCategory[cat] || 0) + l.qty * l.price);
    }
  }

  res.json({
    kpi: {
      monthRevenue: round(monthRevenue), monthExpense: round(monthExpense), monthProfit: round(monthRevenue - monthExpense),
      revenue: round(invs.reduce((s, x) => s + x.totalUsd, 0)), expense: round(bills.reduce((s, x) => s + x.totalUsd, 0)),
      ar: round(arOpen), ap: round(apOpen), cash, inventory: round(inventory), invValue: round(invValue),
      customers: db.contacts.filter((c) => c.kind === 'customer').length,
      products: db.products.length, openInvoices: invs.filter((x) => x.status !== 'paid').length,
      openBills: bills.filter((x) => x.status !== 'paid').length
    },
    chart: { labels, revenue: revenueSeries, expense: expenseSeries },
    lowStock,
    recent,
    invByCategory,
    monthLabel: month
  });
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------- Generic CRUD ----------------
function ensureAccount(acct) {
  if (!db.accounts.find((a) => a.id === acct.id)) {
    db.accounts.push(acct);
    return true;
  }
  return false;
}

function postInventoryAdjustment(product, oldQty = 0, oldCost = 0, opening = false) {
  const oldVal = oldQty * oldCost;
  const newVal = (product.qty || 0) * (product.cost || 0);
  const delta = round(newVal - oldVal);
  if (!delta) return;
  const offset = opening ? 'equity' : 'inv_adj';
  if (offset === 'inv_adj') ensureAccount({ id: 'inv_adj', code: '5900', name: 'Stock Adjustments', type: 'expense', category: 'Operating' });
  const lines = delta > 0
    ? [{ accountId: 'inventory', debit: delta }, { accountId: offset, credit: delta }]
    : [{ accountId: 'inventory', credit: -delta }, { accountId: offset, debit: -delta }];
  store.insertJournal({
    date: today(),
    memo: opening ? `Opening stock - ${product.sku} ${product.name}` : `Stock adjustment - ${product.sku} ${product.name}`,
    ref: product.sku, docType: 'stockAdjustment', docId: product.id, lines
  });
}

app.post('/api/:col', (req, res) => {
  const { col } = req.params;
  if (!COLLECTIONS.includes(col) || col === 'sales' || col === 'purchases') return res.status(404).json({ error: 'unknown collection' });
  const record = { id: uid(), ...req.body };
  if (col === 'bankAccounts') {
    const glId = uid('acct_');
    const gl = { id: glId, code: String(req.body.code || nextAccountCode('10')), name: req.body.name || 'Bank Account', type: 'asset', category: 'Bank', ...(req.body.currency ? { currency: req.body.currency } : {}) };
    db.accounts.push(gl);
    record.accountId = gl.id;
    const opening = Math.abs(Number(req.body.opening) || 0);
    if (opening > 0) {
      store.insertJournal({
        date: today(), memo: `Opening balance - ${gl.name}`, ref: gl.code, docType: 'opening', docId: gl.id,
        lines: [{ accountId: gl.id, debit: opening }, { accountId: 'retained', credit: opening }]
      });
    }
  }
  store.insert(col, record);
  if (col === 'products') postInventoryAdjustment(record, 0, 0, true);
  store.save();
  res.status(201).json(record);
});

function nextAccountCode(prefix) {
  const nums = db.accounts
    .map((a) => a.code)
    .filter((c) => String(c).startsWith(prefix))
    .map((c) => parseInt(String(c), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) + 1 : parseInt(prefix + '00', 10));
  return String(next);
}

app.get('/api/:col', (req, res) => {
  if (!COLLECTIONS.includes(req.params.col)) return res.status(404).json({ error: 'unknown collection' });
  const list = store.collection(req.params.col);
  const sorted = list.slice().sort((a, b) => (b.date || b.number || '').localeCompare(a.date || a.number || ''));
  res.json(sorted);
});

app.get('/api/:col/:id', (req, res) => {
  const rec = store.find(req.params.col, req.params.id);
  if (!rec) return res.status(404).json({ error: 'not found' });
  res.json(rec);
});

app.put('/api/:col/:id', (req, res) => {
  const { col, id } = req.params;
  if (!COLLECTIONS.includes(col)) return res.status(404).json({ error: 'unknown collection' });
  const prev = store.find(col, id);
  const updated = store.update(col, id, req.body);
  if (!updated) return res.status(404).json({ error: 'not found' });
  if (col === 'products' && prev) postInventoryAdjustment(updated, prev.qty || 0, prev.cost || 0, false);
  store.save();
  res.json(updated);
});

app.delete('/api/:col/:id', (req, res) => {
  const { col, id } = req.params;
  if (!COLLECTIONS.includes(col)) return res.status(404).json({ error: 'unknown collection' });
  const ok = store.remove(col, id);
  store.save();
  res.json({ ok });
});

// ---------------- Static frontend (production) ----------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'frontend', 'dist');

// Graceful shutdown: flush any pending Supabase sync before exit.
function shutdown(signal) {
  console.log(`[shutdown] ${signal} received, flushing Supabase sync...`);
  store
    .syncNow()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('[shutdown] sync flush failed:', e.message);
      process.exit(1);
    });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
