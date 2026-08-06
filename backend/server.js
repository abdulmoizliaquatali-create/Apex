import express from 'express';
import cors from 'cors';
import { store, round, uid } from './store.js';
import { seed } from './seed.js';
import { convert, lineTotals, postInvoice, postCustomerPayment, postBill, postSupplierPayment, postBankTransaction, createSalesDoc, createPurchaseDoc } from './ledger.js';

const app = express();
app.use(cors());
app.use(express.json());

let db = store.db;

if (db.accounts.length === 0) {
  console.log('No data found - seeding...');
  seed();
}

// ---------------- Bootstrap ----------------
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/bootstrap', (req, res) => {
  res.json({
    settings: db.settings, currencies: db.currencies, accounts: db.accounts,
    contacts: db.contacts, products: db.products, bankAccounts: db.bankAccounts
  });
});

// ---------------- Generic CRUD (declared at the end so specific routes win) ----------------
const COLLECTIONS = ['contacts', 'products', 'accounts', 'sales', 'purchases', 'bankAccounts', 'bankTransactions', 'journalEntries', 'currencies'];

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

app.post('/api/settings', (req, res) => {
  db.settings = { ...db.settings, ...req.body };
  store.save();
  res.json(db.settings);
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

app.post('/api/reset', (req, res) => {
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
  const bankSet = new Set(['bank_main', 'bank_export', 'bank_pkr']);
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
  const cash = round(bal.bank_main);
  const inventory = round(bal.inventory);
  const invValue = db.products.reduce((s, p) => s + p.qty * p.cost, 0);

  // revenue by month for chart
  const labels = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
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
  store.insert(col, record);
  if (col === 'products') postInventoryAdjustment(record, 0, 0, true);
  store.save();
  res.status(201).json(record);
});

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Apex backend listening on http://localhost:${PORT}`);
});
