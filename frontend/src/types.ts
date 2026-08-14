export interface Settings {
  company: {
    name: string; shortName: string; tagline: string; address: string; city: string; country: string;
    phone: string; email: string; website: string; taxId: string;
  };
  baseCurrency: string; fiscalYearStart: string;
  tax: { name: string; rate: number };
  lowStockThreshold: number;
  preferences?: {
    invoiceDueDays: number; billDueDays: number; quotationValidDays: number;
    receiptBankAccountId: string; paymentBankAccountId: string; defaultCurrency: string;
  };
  modules?: Record<string, boolean>;
  users?: AdminUser[];
}

export interface AdminUser {
  id: string; name: string; email: string; phone?: string; role: 'admin' | 'accountant' | 'viewer'; active: boolean;
  password?: string;
}

export const MODULE_DEFS: { key: string; label: string; desc: string; icon: string }[] = [
  { key: 'sales', label: 'Sales', desc: 'Quotations, orders, invoices, credit notes & receipts', icon: 'sales' },
  { key: 'purchases', label: 'Purchasing', desc: 'Purchase orders, supplier bills, payments & imports', icon: 'purchases' },
  { key: 'inventory', label: 'Products & Stock', desc: 'Product catalog, stock levels and adjustments', icon: 'box' },
  { key: 'banking', label: 'Banking', desc: 'Cash position and bank transactions', icon: 'bank' },
  { key: 'accounting', label: 'Accounting', desc: 'Chart of accounts, journal & general ledger', icon: 'accounting' },
  { key: 'reports', label: 'Reports', desc: 'Financial statements and analytics', icon: 'reports' }
];

export interface Currency { id?: string; code: string; name: string; symbol: string; rate: number; base?: boolean }

export interface FxRates {
  source: string | null;
  updatedAt: string | null;
  fallback: boolean;
  base: string;
}

export interface Account { id: string; code: string; name: string; type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'; category: string; currency?: string; contra?: boolean }

export interface Contact { id: string; kind: 'customer' | 'supplier'; name: string; person: string; email: string; phone: string; address: string; city: string; country: string; currency: string; creditLimit?: number; type?: string; active: boolean }

export interface Product { id: string; sku: string; name: string; category: string; material: string; size: string; color: string; unit: string; cost: number; price: number; qty: number; reorder: number; imported: boolean; origin: string }

export interface LineItem { productId: string; productName: string; sku: string; qty: number; price: number; unit: string }

export interface SalesDoc {
  id: string; type: 'invoice' | 'quotation' | 'salesOrder' | 'creditNote' | 'payment';
  number: string; date: string; dueDate?: string; validUntil?: string;
  customerId?: string; customerName: string;
  currency: string; fxRate: number; subtotal: number; tax: number; total: number;
  subtotalUsd: number; taxUsd: number; totalUsd: number;
  status: string; paidUsd?: number; lines: LineItem[]; bankAccountId?: string; amountUsd?: number;
}

export interface PurchaseDoc {
  id: string; type: 'bill' | 'purchaseOrder' | 'supplierPayment';
  number: string; date: string; dueDate?: string; expectedDate?: string;
  supplierId?: string; supplierName: string;
  currency: string; fxRate: number; subtotal: number; freight?: number; customs?: number; total: number;
  subtotalUsd: number; freightUsd?: number; customsUsd?: number; totalUsd: number;
  status: string; paidUsd?: number; lines: LineItem[];
}

export interface BankAccount { id: string; name: string; accountId: string; currency: string; bank: string; number: string; opening: number }

export interface JournalEntry { id: string; date: string; memo: string; ref: string; docType: string; docId: string; lines: { accountId: string; debit?: number; credit?: number }[] }

export interface Dashboard {
  kpi: Record<string, number>;
  chart: { labels: string[]; revenue: number[]; expense: number[] };
  lowStock: Product[];
  recent: { id: string; date: string; memo: string; ref: string; amount: number }[];
  invByCategory: Record<string, number>;
  monthLabel: string;
}
