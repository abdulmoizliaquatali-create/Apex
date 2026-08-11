import { uid, round } from './store.js';

export function cur(db, code) {
  return (db.currencies.find((c) => c.code === code) || { rate: 1 }).rate;
}

export function convert(db, amount, code) {
  const rate = cur(db, code);
  return round(amount / rate);
}

export function lineTotals(lines) {
  let sub = 0;
  for (const l of lines || []) sub += l.qty * l.price;
  return round(sub);
}

export function addJournal(db, entry) {
  db.journalEntries.push({ ...entry, id: uid('je_') });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Map a bank account (or preference) to its general-ledger asset account.
function bankGlFor(db, bankAccountId, kind) {
  const prefs = (db.settings && db.settings.preferences) || {};
  const def = kind === 'receipt' ? prefs.receiptBankAccountId : prefs.paymentBankAccountId;
  const id = bankAccountId || def;
  const ba = (db.bankAccounts || []).find((b) => b.id === id);
  return ba ? ba.accountId || 'bank_main' : 'bank_main';
}

export function postInvoice(db, p) {
  const { customer, lines, currency, date, taxRate = 0 } = p;
  const num = db.sequences.INV = (db.sequences.INV || 1000) + 1;
  const subtotal = lineTotals(lines);
  const tax = round(subtotal * taxRate);
  const total = round(subtotal + tax);
  const isExport = currency !== 'PKR';
  const doc = {
    id: uid('inv_'), type: 'invoice', number: 'INV-' + num, date,
    dueDate: p.dueDate || addDays(date, 30), customerId: customer.id, customerName: customer.name,
    currency, fxRate: cur(db, currency), subtotal, tax, total,
    subtotalUsd: convert(db, subtotal, currency), taxUsd: convert(db, tax, currency), totalUsd: convert(db, total, currency),
    status: 'posted', paidUsd: 0, lines
  };
  db.sales.push(doc);

  const jeLines = [{ accountId: 'ar', debit: doc.totalUsd }];
  if (tax > 0) jeLines.push({ accountId: 'vat', credit: doc.taxUsd });
  jeLines.push({ accountId: isExport ? 'rev_export' : 'rev_local', credit: doc.subtotalUsd });
  addJournal(db, { date: doc.date, memo: `Invoice ${doc.number} - ${customer.name}`, ref: doc.number, docType: 'invoice', docId: doc.id, lines: jeLines });

  let cogs = 0;
  for (const l of lines) {
    const prod = db.products.find((x) => x.id === l.productId);
    if (!prod) continue;
    prod.qty = prod.qty - l.qty;
    cogs += l.qty * prod.cost;
  }
  if (cogs > 0) addJournal(db, { date: doc.date, memo: `COGS - Invoice ${doc.number}`, ref: doc.number, docType: 'invoice', docId: doc.id, lines: [{ accountId: 'cogs', debit: round(cogs) }, { accountId: 'inventory', credit: round(cogs) }] });
  return doc;
}

export function postCustomerPayment(db, p) {
  const { invoice, customer, amount, currency, date } = p;
  const num = db.sequences.REC = (db.sequences.REC || 1000) + 1;
  const amountUsd = convert(db, amount, currency);
  invoice.paidUsd = round(invoice.paidUsd + amountUsd);
  if (invoice.paidUsd >= invoice.totalUsd - 0.01) invoice.status = 'paid';
  const bankAccountId = p.bankAccountId || (db.settings && db.settings.preferences && db.settings.preferences.receiptBankAccountId) || 'ba1';
  const bankGl = bankGlFor(db, bankAccountId, 'receipt');
  const rec = {
    id: uid('rec_'), type: 'payment', number: 'REC-' + num, date,
    invoiceId: invoice.id, customerId: customer.id, customerName: customer.name,
    currency, fxRate: cur(db, currency), amount, amountUsd, bankAccountId
  };
  db.sales.push(rec);
  addJournal(db, { date: rec.date, memo: `Payment ${rec.number} - ${customer.name}`, ref: rec.number, docType: 'payment', docId: rec.id, lines: [{ accountId: bankGl, debit: amountUsd }, { accountId: 'ar', credit: amountUsd }] });
  return rec;
}

export function postBill(db, p) {
  const { supplier, lines, currency, date } = p;
  const num = db.sequences.BILL = (db.sequences.BILL || 1000) + 1;
  const subtotal = lineTotals(lines);
  const rate = cur(db, currency);
  const freightUsd = p.freightUsd || 0;
  const customsUsd = p.customsUsd || 0;
  const freight = round(freightUsd * rate);
  const customs = round(customsUsd * rate);
  const total = round(subtotal + freight + customs);
  const doc = {
    id: uid('bill_'), type: 'bill', number: 'BILL-' + num, date,
    dueDate: p.dueDate || addDays(date, 45), supplierId: supplier.id, supplierName: supplier.name,
    currency, fxRate: rate, subtotal, freight, customs, total,
    subtotalUsd: convert(db, subtotal, currency), freightUsd, customsUsd,
    totalUsd: round(convert(db, subtotal, currency) + freightUsd + customsUsd),
    status: 'posted', paidUsd: 0, lines
  };
  db.purchases.push(doc);

  const jeLines = [{ accountId: 'inventory', debit: doc.subtotalUsd }];
  if (freightUsd > 0) jeLines.push({ accountId: 'freight', debit: freightUsd });
  if (customsUsd > 0) jeLines.push({ accountId: 'customs', debit: customsUsd });
  jeLines.push({ accountId: 'ap', credit: doc.totalUsd });
  addJournal(db, { date: doc.date, memo: `Bill ${doc.number} - ${supplier.name}`, ref: doc.number, docType: 'bill', docId: doc.id, lines: jeLines });

  for (const l of lines) {
    const prod = db.products.find((x) => x.id === l.productId);
    if (!prod) continue;
    prod.qty += l.qty;
  }
  return doc;
}

export function postSupplierPayment(db, p) {
  const { bill, supplier, amount, currency, date } = p;
  const num = db.sequences.PAY = (db.sequences.PAY || 1000) + 1;
  const amountUsd = convert(db, amount, currency);
  bill.paidUsd = round(bill.paidUsd + amountUsd);
  if (bill.paidUsd >= bill.totalUsd - 0.01) bill.status = 'paid';
  const bankAccountId = p.bankAccountId || (db.settings && db.settings.preferences && db.settings.preferences.paymentBankAccountId) || 'ba1';
  const bankGl = bankGlFor(db, bankAccountId, 'payment');
  const pay = {
    id: uid('pay_'), type: 'supplierPayment', number: 'PAY-' + num, date,
    billId: bill.id, supplierId: supplier.id, supplierName: supplier.name,
    currency, fxRate: cur(db, currency), amount, amountUsd, bankAccountId
  };
  db.purchases.push(pay);
  addJournal(db, { date: pay.date, memo: `Payment ${pay.number} - ${supplier.name}`, ref: pay.number, docType: 'supplierPayment', docId: pay.id, lines: [{ accountId: 'ap', debit: amountUsd }, { accountId: bankGl, credit: amountUsd }] });
  return pay;
}

export function postBankTransaction(db, p) {
  const ba = db.bankAccounts.find((b) => b.id === p.bankAccountId) || db.bankAccounts[0] || { id: 'ba1', accountId: 'bank_main' };
  const bankAccountId = ba.id;
  const bankGl = ba.accountId || 'bank_main';
  const { date, memo, accountId, amountUsd } = p;
  const tx = { id: uid('btx_'), date, memo, accountId, bankAccountId, amountUsd, currency: 'USD', fxRate: 1 };
  db.bankTransactions.push(tx);
  const abs = Math.abs(amountUsd);
  const lines = amountUsd < 0
    ? [{ accountId, debit: abs }, { accountId: bankGl, credit: abs }]
    : [{ accountId: bankGl, debit: abs }, { accountId, credit: abs }];
  addJournal(db, { date, memo, ref: tx.id, docType: 'bankTransaction', docId: tx.id, lines });
  return tx;
}
export const postExpense = postBankTransaction;

export function createSalesDoc(db, type, p) {
  const prefix = { quotation: 'QTN', salesOrder: 'SO', creditNote: 'CN' }[type] || 'DOC';
  const num = db.sequences[prefix] = (db.sequences[prefix] || 1000) + 1;
  const { customer, lines, currency } = p;
  const subtotal = lineTotals(lines);
  const tax = round(subtotal * (p.taxRate || 0));
  const total = round(subtotal + tax);
  const doc = {
    id: uid(type === 'creditNote' ? 'cn_' : type === 'salesOrder' ? 'so_' : 'quo_'),
    type, number: prefix + '-' + num, date: p.date, customerId: customer.id, customerName: customer.name,
    currency, fxRate: cur(db, currency), subtotal, tax, total,
    subtotalUsd: convert(db, subtotal, currency), taxUsd: convert(db, tax, currency), totalUsd: convert(db, total, currency),
    status: p.status || (type === 'quotation' ? 'draft' : 'confirmed'), lines,
    validUntil: p.validUntil, expectedDate: p.expectedDate
  };
  db.sales.push(doc);
  if (type === 'creditNote') {
    addJournal(db, { date: doc.date, memo: `Credit Note ${doc.number} - ${customer.name}`, ref: doc.number, docType: 'creditNote', docId: doc.id, lines: [{ accountId: 'rev_returns', debit: doc.totalUsd }, { accountId: 'ar', credit: doc.totalUsd }] });
  }
  return doc;
}

export function createPurchaseDoc(db, type, p) {
  const prefix = { purchaseOrder: 'PO' }[type] || 'DOC';
  const num = db.sequences[prefix] = (db.sequences[prefix] || 1000) + 1;
  const { supplier, lines, currency } = p;
  const subtotal = lineTotals(lines);
  const doc = {
    id: uid('po_'), type, number: prefix + '-' + num, date: p.date,
    supplierId: supplier.id, supplierName: supplier.name, currency, fxRate: cur(db, currency),
    subtotal, tax: 0, total: subtotal, subtotalUsd: convert(db, subtotal, currency),
    taxUsd: 0, totalUsd: convert(db, subtotal, currency), status: p.status || 'draft',
    expectedDate: p.expectedDate, lines
  };
  db.purchases.push(doc);
  return doc;
}

// ---------------- Workflow automation ----------------

// Convert a quotation -> sales order -> invoice (never reposts the same stock).
export function convertSalesDoc(db, id, to, opts = {}) {
  const src = db.sales.find((x) => x.id === id);
  if (!src) throw new Error('document not found');
  if (src.type !== 'quotation' && src.type !== 'salesOrder') throw new Error('only quotations and sales orders can be converted');
  if (src.status === 'cancelled') throw new Error('cancelled documents cannot be converted');
  if (src.status === 'converted') throw new Error('document has already been converted');
  const customer = db.contacts.find((c) => c.id === src.customerId);
  if (!customer) throw new Error('customer missing');
  const lines = (src.lines || []).map((l) => ({ productId: l.productId, qty: l.qty, price: l.price }));
  let doc;
  if (to === 'invoice') {
    const prefs = (db.settings && db.settings.preferences) || {};
    const taxRate = ((db.settings && db.settings.tax && db.settings.tax.rate) || 0) / 100;
    doc = postInvoice(db, {
      customer, lines, currency: src.currency, date: opts.date || today(), taxRate,
      dueDate: opts.dueDate || addDays(opts.date || today(), prefs.invoiceDueDays || 30)
    });
  } else if (to === 'salesOrder') {
    doc = createSalesDoc(db, 'salesOrder', { customer, lines, currency: src.currency, date: opts.date || today(), status: 'confirmed', expectedDate: opts.expectedDate });
  } else {
    throw new Error('unknown target type');
  }
  src.status = 'converted';
  return { converted: src, doc };
}

// Receive goods against a purchase order -> creates the supplier bill.
export function receivePurchaseOrder(db, id, opts = {}) {
  const src = db.purchases.find((x) => x.id === id);
  if (!src) throw new Error('document not found');
  if (src.type !== 'purchaseOrder') throw new Error('only purchase orders can be received');
  if (src.status === 'cancelled') throw new Error('cancelled purchase orders cannot be received');
  if (src.status === 'received') throw new Error('purchase order has already been received');
  const supplier = db.contacts.find((c) => c.id === src.supplierId);
  if (!supplier) throw new Error('supplier missing');
  const lines = (src.lines || []).map((l) => ({ productId: l.productId, qty: l.qty, price: l.price }));
  const prefs = (db.settings && db.settings.preferences) || {};
  const date = opts.date || today();
  const bill = postBill(db, {
    supplier, lines, currency: src.currency, date,
    dueDate: opts.dueDate || addDays(date, prefs.billDueDays || 45),
    freightUsd: opts.freightUsd || 0, customsUsd: opts.customsUsd || 0
  });
  src.status = 'received';
  return { received: src, bill };
}

// Manual stock adjustment (positive to add, negative to remove).
export function adjustStock(db, product, deltaQty, memo) {
  const oldQty = product.qty || 0;
  const newQty = Math.max(0, oldQty + deltaQty);
  const deltaVal = round((newQty - oldQty) * (product.cost || 0));
  if (!deltaVal && newQty === oldQty) return { product, delta: 0 };
  product.qty = newQty;
  const desc = memo || `Stock adjustment - ${product.sku} ${product.name}`;
  const lines = deltaVal > 0
    ? [{ accountId: 'inventory', debit: deltaVal }, { accountId: 'inv_adj', credit: deltaVal }]
    : [{ accountId: 'inventory', credit: -deltaVal }, { accountId: 'inv_adj', debit: -deltaVal }];
  if (deltaVal) addJournal(db, { date: today(), memo: desc, ref: product.sku, docType: 'stockAdjustment', docId: product.id, lines });
  return { product, delta: deltaQty };
}

function reverseLines(lines) {
  return lines.map((l) => ({ accountId: l.accountId, debit: l.credit || 0, credit: l.debit || 0 }));
}

function voidJournal(db, doc, filter) {
  for (const je of db.journalEntries.filter((j) => j.docType === filter && j.docId === doc.id)) {
    addJournal(db, { date: today(), memo: `Void ${je.memo}`, ref: je.ref, docType: 'void', docId: doc.id, lines: reverseLines(je.lines) });
  }
}

// Void/cancel a document, reversing every posting it made.
export function cancelDoc(db, doc) {
  if (doc.status === 'cancelled') return doc;
  // Automatically void any payments linked to this document.
  const linkedPayments = doc.type === 'invoice'
    ? db.sales.filter((x) => x.type === 'payment' && x.invoiceId === doc.id && x.status !== 'cancelled')
    : doc.type === 'bill'
      ? db.purchases.filter((x) => x.type === 'supplierPayment' && x.billId === doc.id && x.status !== 'cancelled')
      : [];
  for (const pay of linkedPayments) cancelDoc(db, pay);

  if (doc.type === 'invoice') {
    voidJournal(db, doc, 'invoice');
    for (const l of doc.lines || []) {
      const prod = db.products.find((x) => x.id === l.productId);
      if (prod) prod.qty = round(prod.qty + l.qty);
    }
  } else if (doc.type === 'creditNote') {
    voidJournal(db, doc, 'creditNote');
  } else if (doc.type === 'payment') {
    const inv = db.sales.find((x) => x.id === doc.invoiceId);
    if (inv) {
      inv.paidUsd = round((inv.paidUsd || 0) - (doc.amountUsd || 0));
      if (inv.paidUsd < inv.totalUsd - 0.01) inv.status = 'posted';
    }
    voidJournal(db, doc, 'payment');
  } else if (doc.type === 'supplierPayment') {
    const bill = db.purchases.find((x) => x.id === doc.billId);
    if (bill) {
      bill.paidUsd = round((bill.paidUsd || 0) - (doc.amountUsd || 0));
      if (bill.paidUsd < bill.totalUsd - 0.01) bill.status = 'posted';
    }
    voidJournal(db, doc, 'supplierPayment');
  } else if (doc.type === 'bill') {
    voidJournal(db, doc, 'bill');
    for (const l of doc.lines || []) {
      const prod = db.products.find((x) => x.id === l.productId);
      if (prod) prod.qty = round(prod.qty - l.qty);
    }
  }
  doc.status = 'cancelled';
  return doc;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
