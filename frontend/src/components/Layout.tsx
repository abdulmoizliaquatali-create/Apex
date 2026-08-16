import { NavLink, useNavigate } from 'react-router-dom';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useData } from '../state';
import { useAuth, ROLE_LABEL } from '../auth';
import { useTheme } from '../theme';
import { useToast } from '../toast';
import { api } from '../api';
import { Icon } from './ui';

type Hit = { label: string; sub: string; to: string; icon: string };

const NAV: { group: string; items: { to: string; label: string; icon: string; mod?: string }[] }[] = [
  { group: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: 'dashboard' }] },
  {
    group: 'Sales',
    items: [
      { to: '/sales/quotations', label: 'Quotations', icon: 'doc', mod: 'sales' },
      { to: '/sales/orders', label: 'Sales Orders', icon: 'sales', mod: 'sales' },
      { to: '/sales/invoices', label: 'Invoices', icon: 'money', mod: 'sales' },
      { to: '/sales/credit-notes', label: 'Credit Notes', icon: 'doc', mod: 'sales' },
      { to: '/sales/payments', label: 'Customer Payments', icon: 'wallet', mod: 'sales' }
    ]
  },
  {
    group: 'Purchasing',
    items: [
      { to: '/purchases/orders', label: 'Purchase Orders', icon: 'purchases', mod: 'purchases' },
      { to: '/purchases/bills', label: 'Supplier Bills', icon: 'doc', mod: 'purchases' },
      { to: '/purchases/payments', label: 'Supplier Payments', icon: 'wallet', mod: 'purchases' },
      { to: '/purchases/imports', label: 'Import Shipments', icon: 'ship', mod: 'purchases' }
    ]
  },
  {
    group: 'Inventory',
    items: [
      { to: '/products', label: 'Products & Stock', icon: 'box', mod: 'inventory' },
      { to: '/contacts/customers', label: 'Customers', icon: 'customers' },
      { to: '/contacts/suppliers', label: 'Suppliers', icon: 'suppliers' }
    ]
  },
  {
    group: 'Finance',
    items: [
      { to: '/banking', label: 'Banking', icon: 'bank', mod: 'banking' },
      { to: '/accounting/chart', label: 'Chart of Accounts', icon: 'accounting', mod: 'accounting' },
      { to: '/accounting/journal', label: 'Journal & Ledger', icon: 'accounting', mod: 'accounting' },
      { to: '/reports', label: 'Reports', icon: 'reports', mod: 'reports' }
    ]
  },
  { group: 'Administration', items: [{ to: '/admin', label: 'Admin & Settings', icon: 'settings' }] }
];

export default function Layout({ children }: { children: ReactNode }) {
  const { settings, dashboard, products, contacts, sales, purchases, currencies, refresh } = useData();
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const modules = settings?.modules || {};
  const canAdmin = user?.role === 'admin';
  const openInvoices = dashboard?.kpi?.openInvoices || 0;
  const openBills = dashboard?.kpi?.openBills || 0;
  const lowStock = dashboard?.lowStock?.length || 0;
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const [curOpen, setCurOpen] = useState(false);
  const [curBusy, setCurBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setFocused(false);
      if (curRef.current && !curRef.current.contains(e.target as Node)) setCurOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function changeBase(code: string) {
    if (code === settings?.baseCurrency) { setCurOpen(false); return; }
    setCurBusy(true);
    try {
      await api.post('/settings/base-currency', { code });
      await refresh();
      toast(`Reporting currency changed to ${code}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setCurBusy(false);
      setCurOpen(false);
    }
  }

  const baseCode = settings?.baseCurrency || 'USD';
  const baseCur = currencies.find((c) => c.code === baseCode);

  const hits: Hit[] = (() => {
    if (!q.trim()) return [];
    const t = q.trim().toLowerCase();
    const out: Hit[] = [];
    for (const p of products) if (p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)) out.push({ label: p.name, sub: `${p.sku} · ${p.category}`, to: `/products?q=${encodeURIComponent(p.name)}`, icon: 'box' });
    for (const c of contacts) if (c.name.toLowerCase().includes(t)) out.push({ label: c.name, sub: c.kind === 'customer' ? 'Customer' : 'Supplier', to: c.kind === 'customer' ? `/contacts/customers?q=${encodeURIComponent(c.name)}` : `/contacts/suppliers?q=${encodeURIComponent(c.name)}`, icon: c.kind === 'customer' ? 'customers' : 'suppliers' });
    for (const d of sales) if (d.number.toLowerCase().includes(t) || (d.customerName || '').toLowerCase().includes(t)) out.push({ label: d.number, sub: `${d.customerName} · ${d.type}`, to: `/sales/invoices?q=${encodeURIComponent(d.number)}`, icon: 'doc' });
    for (const d of purchases) if (d.number.toLowerCase().includes(t) || (d.supplierName || '').toLowerCase().includes(t)) out.push({ label: d.number, sub: `${d.supplierName} · ${d.type}`, to: `/purchases/bills?q=${encodeURIComponent(d.number)}`, icon: 'doc' });
    return out.slice(0, 12);
  })();

  function go(h: Hit) {
    setQ('');
    setFocused(false);
    navigate(h.to);
  }

  const visibleNav = NAV.map((g) => ({
    ...g,
    items: g.items.filter((it) => {
      if (it.to === '/admin' && !canAdmin) return false;
      return !it.mod || modules[it.mod] !== false;
    })
  })).filter((g) => g.items.length);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="brand-logo">A</div>
          <div>
            <div className="brand-name">{settings?.company?.shortName || 'Apex'}</div>
            <div className="brand-sub">{settings?.company?.tagline || 'Gloves & Textiles'}</div>
          </div>
        </div>
        {visibleNav.map((g) => (
          <div className="nav-group" key={g.group}>
            <div className="nav-group-title">{g.group}</div>
            {g.items.map((it) => {
              const badge = it.to === '/sales/invoices' ? openInvoices : it.to === '/purchases/bills' ? openBills : it.to === '/products' ? lowStock : 0;
              return (
                <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Icon name={it.icon} className="nav-icon" />
                  <span>{it.label}</span>
                  {badge > 0 && <span className={`nav-badge ${it.to === '/products' ? 'teal' : ''}`}>{badge}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
        <div className="sidebar-footer">
          Apex ERP v1.7.0 · Trading &amp; accounting suite<br />Data stored locally
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-search" ref={searchRef}>
            <Icon name="search" size={15} />
            <input
              placeholder="Search products, contacts, documents..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocused(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) go(hits[0]); }}
            />
            {focused && q.trim() && (
              <div className="search-pop">
                {hits.length ? hits.map((h, i) => (
                  <button key={i} className="search-item" onClick={() => go(h)}>
                    <Icon name={h.icon} size={15} />
                    <div className="grow"><div className="search-label">{h.label}</div><div className="tiny muted">{h.sub}</div></div>
                  </button>
                )) : <div className="search-empty">No matches</div>}
              </div>
            )}
          </div>
          <div className="topbar-spacer" />
          <button className="theme-btn" onClick={toggle} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle theme">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>
          <div className="cur-switch" ref={curRef}>
            <button className="currency-pill" onClick={() => setCurOpen((o) => !o)} title="Change reporting currency">
              <Icon name="globe" size={13} /> {baseCur?.symbol || '$'} {baseCode} <span className="caret" />
            </button>
            {curOpen && (
              <div className="cur-pop">
                <div className="cur-pop-title">Reporting currency</div>
                {currencies.map((c) => (
                  <button key={c.code} className={`cur-item ${c.code === baseCode ? 'active' : ''}`} onClick={() => changeBase(c.code)} disabled={curBusy}>
                    <span className="cur-sym">{c.symbol}</span>
                    <span className="grow"><span className="cur-code">{c.code}</span><span className="tiny muted">{c.name}</span></span>
                    {c.code === baseCode && <Icon name="check" size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="user-menu" ref={userRef}>
            <button className="avatar" title={user?.name || 'Account'} onClick={() => setMenuOpen((o) => !o)}>
              {(user?.name || 'A').slice(0, 1)}
            </button>
            {menuOpen && (
              <div className="user-pop">
                <div className="user-pop-head">
                  <div className="strong small">{user?.name}</div>
                  <div className="tiny muted">{ROLE_LABEL[user?.role || ''] || user?.role}</div>
                </div>
                {canAdmin && (
                  <button className="user-item" onClick={() => { setMenuOpen(false); navigate('/admin'); }}>
                    <Icon name="settings" size={14} /> Admin &amp; Settings
                  </button>
                )}
                <button className="user-item" onClick={() => { setMenuOpen(false); logout(); }}>
                  <Icon name="logOut" size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
