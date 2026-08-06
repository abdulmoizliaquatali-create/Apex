import { createContext, useContext, useCallback, useEffect, useState, ReactNode } from 'react';
import { api } from './api';
import type { Settings, Currency, Account, Contact, Product, SalesDoc, PurchaseDoc, BankAccount, JournalEntry, Dashboard } from './types';

interface Data {
  settings: Settings;
  currencies: Currency[];
  accounts: Account[];
  contacts: Contact[];
  products: Product[];
  bankAccounts: BankAccount[];
  sales: SalesDoc[];
  purchases: PurchaseDoc[];
  journal: JournalEntry[];
  dashboard: Dashboard | null;
  ready: boolean;
  refresh: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
}

const Ctx = createContext<Data>(null as unknown as Data);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Partial<Data>>({});
  const [ready, setReady] = useState(false);

  const loadAll = useCallback(async () => {
    const [boot, sales, purchases, journal, dashboard] = await Promise.all([
      api.get('/bootstrap'),
      api.get('/sales'),
      api.get('/purchases'),
      api.get('/journalEntries'),
      api.get('/dashboard')
    ]);
    setState({ ...boot, sales, purchases, journal, dashboard });
    setReady(true);
  }, []);

  const refreshDashboard = useCallback(async () => {
    const dashboard = await api.get('/dashboard');
    setState((s) => ({ ...s, dashboard }));
  }, []);

  const refresh = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadAll().catch(console.error);
  }, [loadAll]);

  const value: Data = {
    settings: state.settings as Settings,
    currencies: state.currencies || [],
    accounts: state.accounts || [],
    contacts: state.contacts || [],
    products: state.products || [],
    bankAccounts: state.bankAccounts || [],
    sales: state.sales || [],
    purchases: state.purchases || [],
    journal: state.journal || [],
    dashboard: state.dashboard || null,
    ready,
    refresh,
    refreshDashboard
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);

export function fmt(n: number, symbol = '$') {
  const sign = n < 0 ? '-' : '';
  return `${sign}${symbol}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtQty(n: number) {
  return n.toLocaleString('en-US');
}

export function curSymbol(code: string, currencies: Currency[]) {
  return (currencies.find((c) => c.code === code) || { symbol: '' }).symbol;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function statusBadge(status: string) {
  const map: Record<string, { cls: string; label: string }> = {
    posted: { cls: 'badge-teal', label: 'Posted' },
    paid: { cls: 'badge-green', label: 'Paid' },
    draft: { cls: 'badge-gray', label: 'Draft' },
    sent: { cls: 'badge-blue', label: 'Sent' },
    confirmed: { cls: 'badge-teal', label: 'Confirmed' },
    open: { cls: 'badge-amber', label: 'Open' },
    overdue: { cls: 'badge-red', label: 'Overdue' },
    partial: { cls: 'badge-amber', label: 'Partial' },
    cancelled: { cls: 'badge-red', label: 'Cancelled' }
  };
  return map[status] || { cls: 'badge-gray', label: status };
}
