export interface Settings {
  company: {
    name: string; shortName: string; tagline: string; address: string; city: string; country: string;
    phone: string; email: string; website: string; taxId: string;
  };
  baseCurrency: string; fiscalYearStart: string;
  tax: { name: string; rate: number };
  lowStockThreshold: number;
}

export interface Currency { id?: string; code: string; name: string; symbol: string; rate: number; base?: boolean }

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
