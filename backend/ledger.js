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
  const rec = {
    id: uid('rec_'), type: 'payment', number: 'REC-' + num, date,
    invoiceId: invoice.id, customerId: customer.id, customerName: customer.name,
    currency, fxRate: cur(db, currency), amount, amountUsd, bankAccountId: p.bankAccountId || 'ba1'
  };
  db.sales.push(rec);
  addJournal(db, { date: rec.date, memo: `Payment ${rec.number} - ${customer.name}`, ref: rec.number, docType: 'payment', docId: rec.id, lines: [{ accountId: 'bank_main', debit: amountUsd }, { accountId: 'ar', credit: amountUsd }] });
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
  const pay = {
    id: uid('pay_'), type: 'supplierPayment', number: 'PAY-' + num, date,
    billId: bill.id, supplierId: supplier.id, supplierName: supplier.name,
    currency, fxRate: cur(db, currency), amount, amountUsd, bankAccountId: p.bankAccountId || 'ba1'
  };
  db.purchases.push(pay);
  addJournal(db, { date: pay.date, memo: `Payment ${pay.number} - ${supplier.name}`, ref: pay.number, docType: 'supplierPayment', docId: pay.id, lines: [{ accountId: 'ap', debit: amountUsd }, { accountId: 'bank_main', credit: amountUsd }] });
  return pay;
}

export function postBankTransaction(db, p) {
  const { date, memo, accountId, amountUsd, bankAccountId = 'ba1' } = p;
  const tx = { id: uid('btx_'), date, memo, accountId, bankAccountId, amountUsd, currency: 'USD', fxRate: 1 };
  db.bankTransactions.push(tx);
  const abs = Math.abs(amountUsd);
  const lines = amountUsd < 0
    ? [{ accountId, debit: abs }, { accountId: 'bank_main', credit: abs }]
    : [{ accountId: 'bank_main', debit: abs }, { accountId, credit: abs }];
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

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
