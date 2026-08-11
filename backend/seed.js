import { store, round, uid } from './store.js';
import { postInvoice, postCustomerPayment, postBill, postSupplierPayment, postExpense } from './ledger.js';

const now = new Date('2026-08-05T12:00:00Z');
const iso = (d) => d.toISOString().slice(0, 10);
const d = (ym, day) => new Date(ym + '-' + String(day).padStart(2, '0') + 'T10:00:00Z');

export function seed() {
  const db = store.db;
  db.meta.seededAt = now.toISOString();

  db.settings = {
    company: {
      name: 'Apex Gloves International', shortName: 'Apex',
      tagline: 'Global glove trading & distribution',
      address: '12-3A Export Processing Zone', city: 'Karachi', country: 'Pakistan',
      phone: '+92 21 3456 7890', email: 'sales@apexgloves.com',
      website: 'www.apexgloves.com', taxId: 'PK-7744311-2'
    },
    baseCurrency: 'USD', fiscalYearStart: '2026-01-01',
    tax: { name: 'Sales Tax', rate: 0 }, lowStockThreshold: 800,
    preferences: {
      invoiceDueDays: 30, billDueDays: 45, quotationValidDays: 30,
      receiptBankAccountId: 'ba1', paymentBankAccountId: 'ba1', defaultCurrency: 'USD'
    },
    modules: {
      sales: true, purchases: true, inventory: true, banking: true, accounting: true, reports: true
    },
    users: [
      { id: 'u1', name: 'Apex Administrator', email: 'admin@apexgloves.com', phone: '+92 21 3456 7890', role: 'admin', active: true },
      { id: 'u2', name: 'Accounts Team', email: 'accounts@apexgloves.com', phone: '+92 21 3456 7891', role: 'accountant', active: true },
      { id: 'u3', name: 'Sales Desk', email: 'salesdesk@apexgloves.com', phone: '+92 21 3456 7892', role: 'viewer', active: false }
    ]
  };

  db.currencies = [
    { id: 'cur_usd', code: 'USD', name: 'US Dollar', symbol: '$', rate: 1, base: true },
    { id: 'cur_eur', code: 'EUR', name: 'Euro', symbol: '€', rate: 0.92, base: false },
    { id: 'cur_gbp', code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.79, base: false },
    { id: 'cur_aed', code: 'AED', name: 'UAE Dirham', symbol: 'AED ', rate: 3.67, base: false },
    { id: 'cur_pkr', code: 'PKR', name: 'Pakistani Rupee', symbol: '₨ ', rate: 278, base: false },
    { id: 'cur_cny', code: 'CNY', name: 'Chinese Yuan', symbol: '¥', rate: 7.22, base: false },
    { id: 'cur_vnd', code: 'VND', name: 'Vietnamese Dong', symbol: '₫', rate: 25400, base: false }
  ];

  db.accounts = [
    { id: 'bank_main', code: '1000', name: 'Main Business Account', type: 'asset', category: 'Bank', currency: 'USD' },
    { id: 'bank_export', code: '1010', name: 'Export Collection Account', type: 'asset', category: 'Bank', currency: 'USD' },
    { id: 'bank_pkr', code: '1020', name: 'Local Rupee Account', type: 'asset', category: 'Bank', currency: 'PKR' },
    { id: 'ar', code: '1100', name: 'Accounts Receivable', type: 'asset', category: 'Current Asset' },
    { id: 'inventory', code: '1200', name: 'Inventory - Gloves', type: 'asset', category: 'Current Asset' },
    { id: 'prepaid', code: '1300', name: 'Prepaid Expenses', type: 'asset', category: 'Current Asset' },
    { id: 'ap', code: '2000', name: 'Accounts Payable', type: 'liability', category: 'Current Liability' },
    { id: 'vat', code: '2100', name: 'Sales Tax Payable', type: 'liability', category: 'Current Liability' },
    { id: 'cust_deposit', code: '2300', name: 'Customer Deposits', type: 'liability', category: 'Current Liability' },
    { id: 'equity', code: '3000', name: 'Owner Capital', type: 'equity', category: 'Equity' },
    { id: 'retained', code: '3100', name: 'Retained Earnings', type: 'equity', category: 'Equity' },
    { id: 'rev_local', code: '4000', name: 'Sales Revenue - Local', type: 'income', category: 'Sales' },
    { id: 'rev_export', code: '4100', name: 'Sales Revenue - Export', type: 'income', category: 'Sales' },
    { id: 'rev_returns', code: '4200', name: 'Sales Returns', type: 'income', category: 'Sales', contra: true },
    { id: 'other_income', code: '4300', name: 'Other Income', type: 'income', category: 'Other' },
    { id: 'fx_gain', code: '4400', name: 'Exchange Gain / Loss', type: 'income', category: 'Other', contra: true },
    { id: 'cogs', code: '5000', name: 'Cost of Goods Sold', type: 'expense', category: 'Direct Costs' },
    { id: 'freight', code: '5100', name: 'Freight & Shipping', type: 'expense', category: 'Direct Costs' },
    { id: 'customs', code: '5200', name: 'Customs & Import Duties', type: 'expense', category: 'Direct Costs' },
    { id: 'salaries', code: '5300', name: 'Salaries & Wages', type: 'expense', category: 'Operating' },
    { id: 'rent', code: '5400', name: 'Rent & Warehousing', type: 'expense', category: 'Operating' },
    { id: 'utilities', code: '5500', name: 'Utilities', type: 'expense', category: 'Operating' },
    { id: 'marketing', code: '5600', name: 'Marketing & Trade Shows', type: 'expense', category: 'Operating' },
    { id: 'admin', code: '5700', name: 'Office & Administration', type: 'expense', category: 'Operating' },
    { id: 'bank_charges', code: '5800', name: 'Bank Charges', type: 'expense', category: 'Operating' },
    { id: 'inv_adj', code: '5900', name: 'Stock Adjustments', type: 'expense', category: 'Operating' }
  ];

  db.contacts = [
    { id: 'c1', kind: 'customer', name: 'Karachi Distributors Ltd', person: 'Imran Qureshi', email: 'purchasing@kdl.pk', phone: '+92 21 3401 2233', address: '14 Shaheed-e-Millat Rd', city: 'Karachi', country: 'Pakistan', currency: 'PKR', creditLimit: 50000, type: 'Distributor', active: true },
    { id: 'c2', kind: 'customer', name: 'National Safety Supplies', person: 'Ayesha Khan', email: 'orders@nss.pk', phone: '+92 42 3571 8844', address: 'F-8 Markaz', city: 'Lahore', country: 'Pakistan', currency: 'PKR', creditLimit: 35000, type: 'Wholesaler', active: true },
    { id: 'c3', kind: 'customer', name: 'TexPort Trading GmbH', person: 'Hannah Weber', email: 'buy@texport.de', phone: '+49 40 7890 1122', address: 'Speicherstadt 22', city: 'Hamburg', country: 'Germany', currency: 'EUR', creditLimit: 60000, type: 'Importer', active: true },
    { id: 'c4', kind: 'customer', name: 'GloveHub Ltd', person: 'Oliver Smith', email: 'po@glovehub.co.uk', phone: '+44 20 7946 0958', address: '120 Bishopsgate', city: 'London', country: 'United Kingdom', currency: 'GBP', creditLimit: 55000, type: 'Distributor', active: true },
    { id: 'c5', kind: 'customer', name: 'SafeWear FZCO', person: 'Rashid Al Mansouri', email: 'sales@safewear.ae', phone: '+971 4 338 7766', address: 'JAFZA One, Jebel Ali', city: 'Dubai', country: 'UAE', currency: 'AED', creditLimit: 40000, type: 'Importer', active: true },
    { id: 'c6', kind: 'customer', name: 'MediCare Wholesale Inc', person: 'Sarah Mitchell', email: 'sarah@medicarewholesale.com', phone: '+1 305 555 0148', address: '8900 NW 27th St', city: 'Miami', country: 'USA', currency: 'USD', creditLimit: 80000, type: 'Healthcare', active: true },
    { id: 's1', kind: 'supplier', name: 'Qingdao Hanwei Glove Co', person: 'Zhang Wei', email: 'export@hanweiglove.cn', phone: '+86 532 8897 1100', address: 'CNB Industrial Park', city: 'Qingdao', country: 'China', currency: 'CNY', type: 'Overseas Factory', active: true },
    { id: 's2', kind: 'supplier', name: 'Hai Phong Safety Corp', person: 'Nguyen Thi Lan', email: 'info@haiphongsafety.vn', phone: '+84 225 356 7788', address: 'Dinh Vu Industrial Zone', city: 'Hai Phong', country: 'Vietnam', currency: 'VND', type: 'Overseas Factory', active: true },
    { id: 's3', kind: 'supplier', name: 'Sialkot Glove Makers', person: 'Chaudhry Mehmood', email: 'sales@sialkotgloves.pk', phone: '+92 52 458 9977', address: 'Glove Industrial Estate', city: 'Sialkot', country: 'Pakistan', currency: 'PKR', type: 'Local Manufacturer', active: true },
    { id: 's4', kind: 'supplier', name: 'Penang Rubber Industries', person: 'Ahmad Faizal', email: 'sales@penangrubber.my', phone: '+60 4 646 2233', address: 'Bayan Lepas FIZ', city: 'Penang', country: 'Malaysia', currency: 'USD', type: 'Overseas Factory', active: true }
  ];

  db.products = [
    { id: 'p1', sku: 'GLV-NTL-100', name: 'Nitrile Exam Gloves - Powder Free', category: 'Disposable', material: 'Nitrile', size: 'M', color: 'Blue', unit: 'Box/100', cost: 3.2, price: 5.8, qty: 2400, reorder: 3800, imported: true, origin: 'Malaysia' },
    { id: 'p2', sku: 'GLV-LTX-100', name: 'Latex Exam Gloves - Powder Free', category: 'Disposable', material: 'Latex', size: 'M', color: 'Natural', unit: 'Box/100', cost: 2.6, price: 4.9, qty: 3100, reorder: 800, imported: true, origin: 'Vietnam' },
    { id: 'p3', sku: 'GLV-VNL-100', name: 'Vinyl Disposable Gloves - Powder Free', category: 'Disposable', material: 'Vinyl', size: 'L', color: 'Clear', unit: 'Box/100', cost: 1.8, price: 3.4, qty: 1900, reorder: 600, imported: true, origin: 'China' },
    { id: 'p4', sku: 'GLV-SRG-050', name: 'Surgical Sterile Gloves - Latex', category: 'Disposable', material: 'Latex', size: 'M', color: 'Natural', unit: 'Box/50', cost: 6.5, price: 11.5, qty: 850, reorder: 1600, imported: true, origin: 'Malaysia' },
    { id: 'p5', sku: 'GLV-NTL-HVY', name: 'Heavy Duty Nitrile Industrial Gloves', category: 'Work', material: 'Nitrile', size: 'L', color: 'Green', unit: 'Pair', cost: 1.9, price: 3.6, qty: 5200, reorder: 1500, imported: true, origin: 'China' },
    { id: 'p6', sku: 'GLV-PUC-001', name: 'PU Coated Work Gloves (13G)', category: 'Work', material: 'PU Coated Nylon', size: 'M', color: 'Grey', unit: 'Pair', cost: 0.65, price: 1.45, qty: 12800, reorder: 3000, imported: true, origin: 'China' },
    { id: 'p7', sku: 'GLV-CUT-L5', name: 'Cut Resistant Gloves - Level 5', category: 'Cut-Resistant', material: 'HPPE', size: 'L', color: 'Grey', unit: 'Pair', cost: 2.4, price: 4.8, qty: 4300, reorder: 1000, imported: true, origin: 'Vietnam' },
    { id: 'p8', sku: 'GLV-CUT-L9', name: 'Cut Resistant Gloves - Level 9', category: 'Cut-Resistant', material: 'Steel + HPPE', size: 'L', color: 'Orange', unit: 'Pair', cost: 4.5, price: 8.9, qty: 2600, reorder: 3500, imported: true, origin: 'Vietnam' },
    { id: 'p9', sku: 'GLV-LTH-COW', name: 'Cowhide Leather Work Gloves', category: 'Leather', material: 'Cowhide', size: 'L', color: 'Tan', unit: 'Pair', cost: 3.8, price: 7.2, qty: 1900, reorder: 600, imported: false, origin: 'Pakistan' },
    { id: 'p10', sku: 'GLV-LTH-WLD', name: 'Split Leather Welding Gloves', category: 'Welding', material: 'Split Leather', size: 'XL', color: 'Tan', unit: 'Pair', cost: 5.2, price: 9.8, qty: 1200, reorder: 2900, imported: false, origin: 'Pakistan' },
    { id: 'p11', sku: 'GLV-WNT-INS', name: 'Insulated Winter Thermal Gloves', category: 'Winter', material: 'Polyester Fleece', size: 'M', color: 'Black', unit: 'Pair', cost: 4.1, price: 8.5, qty: 2200, reorder: 700, imported: true, origin: 'China' },
    { id: 'p12', sku: 'GLV-WNT-WTR', name: 'Winter Waterproof Lined Gloves', category: 'Winter', material: 'Nylon + PVC', size: 'L', color: 'Olive', unit: 'Pair', cost: 4.8, price: 9.4, qty: 1500, reorder: 500, imported: true, origin: 'China' },
    { id: 'p13', sku: 'GLV-KNT-WHT', name: 'Knit Cotton Gloves - Economy White', category: 'Knit', material: 'Cotton', size: '10', color: 'White', unit: 'Dozen', cost: 0.35, price: 0.85, qty: 24000, reorder: 6000, imported: false, origin: 'Pakistan' },
    { id: 'p14', sku: 'GLV-KNT-GRY', name: 'Knit Cotton Gloves - Grey Dipped', category: 'Knit', material: 'Cotton + Latex', size: '10', color: 'Grey', unit: 'Dozen', cost: 0.55, price: 1.2, qty: 18000, reorder: 5000, imported: false, origin: 'Pakistan' },
    { id: 'p15', sku: 'GLV-RBB-HH', name: 'Rubber Household Gloves', category: 'Household', material: 'Natural Rubber', size: 'M', color: 'Yellow', unit: 'Pair', cost: 1.2, price: 2.6, qty: 7600, reorder: 2000, imported: true, origin: 'China' },
    { id: 'p16', sku: 'GLV-NPR-CHM', name: 'Neoprene Chemical Resistant Gloves', category: 'Chemical', material: 'Neoprene', size: 'L', color: 'Black', unit: 'Pair', cost: 7.8, price: 14.9, qty: 900, reorder: 1600, imported: true, origin: 'Malaysia' },
    { id: 'p17', sku: 'GLV-MCH-IMP', name: "Mechanic's Gloves - Impact", category: 'Work', material: 'Spandex + TPR', size: 'L', color: 'Black', unit: 'Pair', cost: 3.3, price: 6.4, qty: 2800, reorder: 900, imported: true, origin: 'China' },
    { id: 'p18', sku: 'GLV-GDN-PVC', name: 'Garden Gloves - PVC Dot', category: 'Household', material: 'Cotton + PVC', size: 'M', color: 'Green', unit: 'Pair', cost: 0.85, price: 1.9, qty: 5400, reorder: 1500, imported: false, origin: 'Pakistan' }
  ];

  const initialStock = round(db.products.reduce((s, p) => s + p.qty * p.cost, 0));
  store.insertJournal({ date: '2026-01-01', memo: 'Opening inventory on hand', ref: 'OPEN', docType: 'opening', docId: 'open2', lines: [{ accountId: 'inventory', debit: initialStock }, { accountId: 'equity', credit: initialStock }] });

  db.bankAccounts = [
    { id: 'ba1', name: 'Main Business Account', accountId: 'bank_main', currency: 'USD', bank: 'Habib Bank Ltd', number: '**** 4421', opening: 250000 },
    { id: 'ba2', name: 'Export Collection Account', accountId: 'bank_export', currency: 'USD', bank: 'Standard Chartered', number: '**** 9032', opening: 0 },
    { id: 'ba3', name: 'Local Rupee Account', accountId: 'bank_pkr', currency: 'PKR', bank: 'Meezan Bank', number: '**** 1187', opening: 8000000 }
  ];

  for (const ba of db.bankAccounts) {
    if (ba.opening > 0 && ba.accountId !== 'bank_main') {
      const fx = db.currencies.find((c) => c.code === ba.currency).rate;
      const openUsd = round(ba.opening / fx);
      store.insertJournal({ date: '2026-01-01', memo: `Opening balance - ${ba.name}`, ref: 'OPEN', docType: 'opening', docId: ba.id, lines: [{ accountId: ba.accountId, debit: openUsd }, { accountId: 'retained', credit: openUsd }] });
    }
  }

  const customersLocal = ['c1', 'c2'];
  const customersExport = ['c3', 'c4', 'c5', 'c6'];
  const localCur = (c) => (c === 'c1' || c === 'c2') ? 'PKR' : db.contacts.find((x) => x.id === c).currency;
  const rate = (code) => db.currencies.find((c) => c.code === code).rate;
  const priceIn = (usd, code) => round(usd * rate(code));

  const purchasePlan = {
    '2026-01': [['s1', 'CNY', [['p6', 3000], ['p15', 2000], ['p17', 900]]], ['s3', 'PKR', [['p9', 800], ['p13', 6000]]]],
    '2026-02': [['s2', 'VND', [['p7', 1500], ['p8', 900]]], ['s4', 'USD', [['p1', 1200], ['p4', 500]]]],
    '2026-03': [['s1', 'CNY', [['p3', 800], ['p5', 2000], ['p12', 700]]], ['s3', 'PKR', [['p14', 6000], ['p10', 500]]]],
    '2026-04': [['s2', 'VND', [['p2', 1600], ['p7', 1200]]], ['s4', 'USD', [['p16', 400]]]],
    '2026-05': [['s1', 'CNY', [['p6', 4000], ['p11', 900], ['p15', 1800]]], ['s3', 'PKR', [['p13', 8000], ['p18', 2000]]]],
    '2026-06': [['s2', 'VND', [['p8', 800], ['p2', 1400]]], ['s4', 'USD', [['p1', 1000]]]],
    '2026-07': [['s1', 'CNY', [['p3', 900], ['p5', 2400], ['p17', 1000], ['p12', 800]]], ['s3', 'PKR', [['p9', 700], ['p14', 5000]]]]
  };

  const months = Object.keys(purchasePlan);
  months.forEach((ym, mi) => {
    purchasePlan[ym].forEach(([sid, cur, items], i) => {
      const lines = items.map(([pid, qty]) => {
        const p = db.products.find((x) => x.id === pid);
        return { productId: pid, productName: p.name, sku: p.sku, qty: Math.round(qty * 1.45), price: priceIn(p.cost, cur), unit: p.unit };
      });
      const freightUsd = mi % 2 === 0 ? 900 : 1200;
      const customsUsd = mi % 2 === 0 ? 450 : 600;
      const bill = postBill(db, { supplier: db.contacts.find((c) => c.id === sid), lines, currency: cur, date: ym + '-' + String(4 + i * 2).padStart(2, '0'), freightUsd, customsUsd });
      postSupplierPayment(db, { bill, supplier: db.contacts.find((c) => c.id === sid), amount: round(bill.total * 0.6), currency: cur, date: ym + '-' + String(20 + i * 2).padStart(2, '0') });
    });

    const winterFactor = mi <= 1 || mi === 6 ? 1.25 : 1;
    const nSales = mi % 2 === 0 ? 5 : 4;
    for (let i = 0; i < nSales; i++) {
      const isExport = i % 2 === 0 ? false : true;
      const cust = isExport ? customersExport[i % customersExport.length] : customersLocal[i % customersLocal.length];
      const cur = localCur(cust);
      const pidx = (i * 3 + mi) % 18;
      const prod = db.products[pidx];
      const qty = Math.round((1500 + i * 500 + mi * 150) * (cur === 'PKR' ? 1.5 : 1) * winterFactor);
      const lines = [{ productId: prod.id, productName: prod.name, sku: prod.sku, qty, price: priceIn(prod.price, cur), unit: prod.unit }];
      const inv = postInvoice(db, { customer: db.contacts.find((c) => c.id === cust), lines, currency: cur, date: ym + '-' + String(6 + i * 4).padStart(2, '0') });
      if (mi <= 4) postCustomerPayment(db, { invoice: inv, customer: db.contacts.find((c) => c.id === cust), amount: inv.total, currency: cur, date: ym + '-' + String(12 + i * 4).padStart(2, '0') });
      else if (mi === 5) postCustomerPayment(db, { invoice: inv, customer: db.contacts.find((c) => c.id === cust), amount: round(inv.total * 0.7), currency: cur, date: ym + '-' + String(14 + i * 3).padStart(2, '0') });
      else postCustomerPayment(db, { invoice: inv, customer: db.contacts.find((c) => c.id === cust), amount: round(inv.total * 0.4), currency: cur, date: ym + '-' + String(15 + i * 3).padStart(2, '0') });
    }

    postExpense(db, { date: ym + '-01', memo: 'Warehouse & office rent', accountId: 'rent', amountUsd: -4200 });
    postExpense(db, { date: ym + '-02', memo: 'Staff salaries', accountId: 'salaries', amountUsd: -9600 });
    postExpense(db, { date: ym + '-03', memo: 'Electricity & utilities', accountId: 'utilities', amountUsd: -1150 });
    postExpense(db, { date: ym + '-10', memo: 'Marketing & catalog design', accountId: 'marketing', amountUsd: mi % 2 ? -1400 : -2600 });
    postExpense(db, { date: ym + '-18', memo: 'Office supplies & admin', accountId: 'admin', amountUsd: -850 });
    postExpense(db, { date: ym + '-25', memo: 'Bank charges', accountId: 'bank_charges', amountUsd: -190 });
  });

  const augInv = postInvoice(db, {
    customer: db.contacts.find((c) => c.id === 'c6'), currency: 'USD', date: '2026-08-03',
    lines: [{ productId: 'p1', productName: db.products[0].name, sku: 'GLV-NTL-100', qty: 600, price: 5.8, unit: 'Box/100' }, { productId: 'p8', productName: db.products[7].name, sku: 'GLV-CUT-L9', qty: 400, price: 8.9, unit: 'Pair' }]
  });
  postCustomerPayment(db, { invoice: augInv, customer: db.contacts.find((c) => c.id === 'c6'), amount: round(augInv.total * 0.5), currency: 'USD', date: '2026-08-04' });

  const augBill = postBill(db, {
    supplier: db.contacts.find((c) => c.id === 's1'), currency: 'CNY', date: '2026-08-04',
    lines: [{ productId: 'p6', productName: db.products[5].name, sku: 'GLV-PUC-001', qty: 5000, price: priceIn(0.65, 'CNY'), unit: 'Pair' }],
    freightUsd: 800, customsUsd: 400
  });
  postSupplierPayment(db, { bill: augBill, supplier: db.contacts.find((c) => c.id === 's1'), amount: round(augBill.subtotal * 0.5), currency: 'CNY', date: '2026-08-05' });

  db.sales.push({
    id: uid('quo_'), type: 'quotation', number: 'QTN-' + (db.sequences.QTN || 1000), date: '2026-08-02',
    validUntil: '2026-08-30', customerId: 'c3', customerName: 'TexPort Trading GmbH',
    currency: 'EUR', fxRate: 0.92, subtotal: 23322, tax: 0, total: 23322, subtotalUsd: 25350, taxUsd: 0, totalUsd: 25350,
    status: 'sent', lines: [{ productId: 'p7', productName: db.products[6].name, sku: 'GLV-CUT-L5', qty: 2500, price: priceIn(4.8, 'EUR'), unit: 'Pair' }, { productId: 'p8', productName: db.products[7].name, sku: 'GLV-CUT-L9', qty: 1500, price: priceIn(8.9, 'EUR'), unit: 'Pair' }]
  });

  db.purchases.push({
    id: uid('po_'), type: 'purchaseOrder', number: 'PO-' + (db.sequences.PO || 1000), date: '2026-08-01',
    expectedDate: '2026-09-15', supplierId: 's2', supplierName: 'Hai Phong Safety Corp',
    currency: 'VND', fxRate: 25400, subtotal: 320040000, tax: 0, total: 320040000, subtotalUsd: 12600, taxUsd: 0, totalUsd: 12600,
    status: 'confirmed', lines: [{ productId: 'p2', productName: db.products[1].name, sku: 'GLV-LTX-100', qty: 3000, price: priceIn(2.6, 'VND'), unit: 'Box/100' }, { productId: 'p7', productName: db.products[6].name, sku: 'GLV-CUT-L5', qty: 2000, price: priceIn(2.4, 'VND'), unit: 'Pair' }]
  });

  store.insertJournal({ date: '2026-01-01', memo: 'Opening capital contribution', ref: 'OPEN', docType: 'opening', docId: 'open1', lines: [{ accountId: 'bank_main', debit: 250000 }, { accountId: 'equity', credit: 250000 }] });

  // Reconcile stock: top up any product that sold more than it was purchased,
  // so the inventory ledger account and on-hand stock stay consistent.
  for (const p of db.products) {
    let sold = 0;
    let bought = 0;
    for (const inv of db.sales.filter((x) => x.type === 'invoice')) for (const l of inv.lines) if (l.productId === p.id) sold += l.qty;
    for (const b of db.purchases.filter((x) => x.type === 'bill')) for (const l of b.lines) if (l.productId === p.id) bought += l.qty;
    const deficit = sold - bought;
    if (deficit > 0) {
      const topUp = Math.ceil(deficit * 1.15);
      const supplier = p.imported ? db.contacts.find((c) => c.id === 's1') : db.contacts.find((c) => c.id === 's3');
      const bill = postBill(db, {
        supplier, currency: 'USD', date: '2026-08-06',
        lines: [{ productId: p.id, productName: p.name, sku: p.sku, qty: topUp, price: p.cost, unit: p.unit }],
        freightUsd: 0, customsUsd: 0
      });
      postSupplierPayment(db, { bill, supplier, amount: round(bill.total * 0.65), currency: 'USD', date: '2026-08-07' });
    }
  }

  store.save();
  console.log('Seed complete.');
}
