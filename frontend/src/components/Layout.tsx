import { NavLink, useNavigate } from 'react-router-dom';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useData } from '../state';
import { Icon } from './ui';

type Hit = { label: string; sub: string; to: string; icon: string };

const NAV = [
  { group: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: 'dashboard' }] },
  { group: 'Sales', items: [
    { to: '/sales/quotations', label: 'Quotations', icon: 'doc' },
    { to: '/sales/orders', label: 'Sales Orders', icon: 'sales' },
    { to: '/sales/invoices', label: 'Invoices', icon: 'money' },
    { to: '/sales/credit-notes', label: 'Credit Notes', icon: 'doc' },
    { to: '/sales/payments', label: 'Customer Payments', icon: 'wallet' }
  ] },
  { group: 'Purchasing', items: [
    { to: '/purchases/orders', label: 'Purchase Orders', icon: 'purchases' },
    { to: '/purchases/bills', label: 'Supplier Bills', icon: 'doc' },
    { to: '/purchases/payments', label: 'Supplier Payments', icon: 'wallet' },
    { to: '/purchases/imports', label: 'Import Shipments', icon: 'ship' }
  ] },
  { group: 'Inventory', items: [
    { to: '/products', label: 'Products & Stock', icon: 'box' },
    { to: '/contacts/customers', label: 'Customers', icon: 'customers' },
    { to: '/contacts/suppliers', label: 'Suppliers', icon: 'suppliers' }
  ] },
  { group: 'Finance', items: [
    { to: '/banking', label: 'Banking', icon: 'bank' },
    { to: '/accounting/chart', label: 'Chart of Accounts', icon: 'accounting' },
    { to: '/accounting/journal', label: 'Journal & Ledger', icon: 'accounting' },
    { to: '/reports', label: 'Reports', icon: 'reports' }
  ] },
  { group: 'Administration', items: [
    { to: '/settings', label: 'Settings', icon: 'settings' }
  ] }
];

export default function Layout({ children }: { children: ReactNode }) {
  const { settings, dashboard, products, contacts, sales, purchases } = useData();
  const navigate = useNavigate();
  const openInvoices = dashboard?.kpi?.openInvoices || 0;
  const openBills = dashboard?.kpi?.openBills || 0;
  const lowStock = dashboard?.lowStock?.length || 0;
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

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
        {NAV.map((g) => (
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
          Apex ERP v2.5.0 · Trading &amp; accounting suite<br />Data stored locally
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
          <span className="currency-pill">Base: USD</span>
          <div className="avatar">{settings?.company?.shortName?.slice(0, 1) || 'A'}</div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
