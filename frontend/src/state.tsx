import { createContext, useContext, useCallback, useEffect, useState, ReactNode } from 'react';
import { api } from './api';
import type { Settings, Currency, Account, Contact, Product, SalesDoc, PurchaseDoc, BankAccount, JournalEntry, Dashboard, FxRates } from './types';

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
  fx: FxRates | null;
  refreshFx: () => Promise<void>;
  ready: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
}

const Ctx = createContext<Data>(null as unknown as Data);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Partial<Data>>({});
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [boot, sales, purchases, journal, dashboard] = await Promise.all([
        api.get('/bootstrap'),
        api.get('/sales'),
        api.get('/purchases'),
        api.get('/journalEntries'),
        api.get('/dashboard')
      ]);
      setState({ ...boot, sales, purchases, journal, dashboard });
      setReady(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    const dashboard = await api.get('/dashboard');
    setState((s) => ({ ...s, dashboard }));
  }, []);

  const refreshFx = useCallback(async () => {
    try {
      const fx = await api.get('/currencies/rates');
      setState((s) => ({ ...s, fx }));
    } catch {}
  }, []);

  // Load FX freshness metadata without blocking the boot (best-effort).
  useEffect(() => {
    refreshFx();
  }, [refreshFx]);

  const refresh = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadAll().catch(console.error);
  }, [loadAll]);

  useEffect(() => {
    const code = state.settings?.baseCurrency || 'USD';
    const cur = (state.currencies || []).find((c) => c.code === code);
    setBaseInfo({ symbol: cur?.symbol || '$', rate: cur?.rate || 1 });
  }, [state.settings, state.currencies]);

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
    fx: state.fx || null,
    refreshFx,
    ready,
    refreshing,
    refresh,
    refreshDashboard
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);

// Base / reporting currency display info. The ledger is stored in USD; when a
// user picks a different base currency, every default fmt() call converts the
// USD amount into the base currency and prefixes its symbol.
let baseInfo = { symbol: '$', rate: 1 };
export function setBaseInfo(info: { symbol: string; rate: number }) {
  baseInfo = info;
}
export function getBaseInfo() {
  return baseInfo;
}

export function fmt(n: number, symbol?: string) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const value = symbol === undefined ? abs * baseInfo.rate : abs;
  const sym = symbol === undefined ? baseInfo.symbol : symbol;
  return `${sign}${sym}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtMoney(n: number) {
  return (n * baseInfo.rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    converted: { cls: 'badge-purple', label: 'Converted' },
    received: { cls: 'badge-purple', label: 'Received' },
    open: { cls: 'badge-amber', label: 'Open' },
    overdue: { cls: 'badge-red', label: 'Overdue' },
    partial: { cls: 'badge-amber', label: 'Partial' },
    cancelled: { cls: 'badge-red', label: 'Cancelled' }
  };
  return map[status] || { cls: 'badge-gray', label: status };
}
