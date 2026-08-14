import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useData, fmt, curSymbol, statusBadge } from '../state';
import { useAuth, canEdit } from '../auth';
import { useToast } from '../toast';
import { api } from '../api';
import { PageHead, Icon, Badge, Empty } from '../components/ui';
import { useSort, SortTh, usePagination, Pagination, FilterBar } from '../components/list';
import DocumentModal, { DocType } from '../components/DocumentModal';
import DocDetail from '../components/DocDetail';
import type { PurchaseDoc } from '../types';

const TABS: { key: string; label: string; type: string }[] = [
  { key: 'orders', label: 'Purchase Orders', type: 'purchaseOrder' },
  { key: 'bills', label: 'Supplier Bills', type: 'bill' },
  { key: 'payments', label: 'Supplier Payments', type: 'supplierPayment' },
  { key: 'imports', label: 'Import Shipments', type: 'imports' }
];

export default function Purchases() {
  const { docType } = useParams();
  const navigate = useNavigate();
  const { purchases, contacts, currencies, refresh, refreshDashboard } = useData();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<PurchaseDoc | null>(null);
  const toast = useToast();
  const editable = canEdit(user);

  const tab = TABS.find((t) => t.key === docType) || TABS[1];
  const createType = (tab.type === 'bill' ? 'bill' : tab.type === 'purchaseOrder' ? 'purchaseOrder' : null) as DocType | null;

  const base = useMemo(() => {
    let docs = purchases;
    if (tab.type === 'imports') {
      const overseas = contacts.filter((c) => c.kind === 'supplier' && c.country !== 'Pakistan').map((c) => c.id);
      docs = purchases.filter((d) => d.type === 'bill' && overseas.includes(d.supplierId as string));
    } else if (tab.type === 'supplierPayment') {
      docs = purchases.filter((d) => d.type === 'supplierPayment');
    } else {
      docs = purchases.filter((d) => d.type === tab.type);
    }
    return docs;
  }, [purchases, contacts, tab]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return base;
    return base.filter((d) => d.number.toLowerCase().includes(t) || d.supplierName.toLowerCase().includes(t));
  }, [base, q]);

  const { sortKey, sortDir, toggle, apply } = useSort<PurchaseDoc>('date', 'desc');
  const sorted = useMemo(() => apply(list), [apply, list]);
  const { page, size, go, setSize, reset, slice } = usePagination<PurchaseDoc>(10);
  const pageRows = useMemo(() => slice(sorted), [slice, sorted]);

  useEffect(() => { reset(); }, [tab, reset]);

  const importTotals = useMemo(() => {
    const overseas = contacts.filter((c) => c.kind === 'supplier' && c.country !== 'Pakistan').map((c) => c.id);
    const bills = purchases.filter((d) => d.type === 'bill' && overseas.includes(d.supplierId as string));
    return {
      count: bills.length,
      goods: bills.reduce((s, b) => s + b.subtotalUsd, 0),
      freight: bills.reduce((s, b) => s + (b.freightUsd || 0), 0),
      customs: bills.reduce((s, b) => s + (b.customsUsd || 0), 0)
    };
  }, [purchases, contacts]);

  async function afterCreate() {
    await refresh();
    await refreshDashboard();
  }

  async function duplicate(d: PurchaseDoc) {
    try {
      await api.post(`/purchases/${d.id}/duplicate`, {});
      toast('Document duplicated');
      await afterCreate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <div className="print-area">
      <PageHead
        title={tab.label}
        sub="Purchase orders, supplier bills and import shipments"
        actions={<>
          <button className="btn btn-secondary no-print" onClick={() => window.print()}><Icon name="printer" size={15} /> Print</button>
          {createType && editable && <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> New {tab.label.replace('Supplier ', '')}</button>}
        </>}
      />

      <div className="toolbar no-print">
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`tab ${t.key === tab.key ? 'active' : ''}`} onClick={() => navigate(`/purchases/${t.key}`)}>{t.label}</button>
          ))}
        </div>
        <div className="grow" />
        <FilterBar query={q} onQuery={(v) => { setQ(v); reset(); }} placeholder="Search by number or supplier..." />
      </div>

      {tab.type === 'imports' && (
        <div className="grid grid-4 mb-16">
          <div className="card card-pad"><div className="tiny muted">Import Shipments</div><div className="strong" style={{ fontSize: 22 }}>{importTotals.count}</div></div>
          <div className="card card-pad"><div className="tiny muted">Goods Value</div><div className="strong" style={{ fontSize: 22 }}>{fmt(importTotals.goods)}</div></div>
          <div className="card card-pad"><div className="tiny muted">Freight & Shipping</div><div className="strong" style={{ fontSize: 22, color: 'var(--accent)' }}>{fmt(importTotals.freight)}</div></div>
          <div className="card card-pad"><div className="tiny muted">Customs & Duties</div><div className="strong" style={{ fontSize: 22, color: 'var(--info)' }}>{fmt(importTotals.customs)}</div></div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh k="number" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Number</SortTh>
                <SortTh k="supplierName" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Supplier</SortTh>
                <SortTh k="date" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Date</SortTh>
                <SortTh k="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Due / ETA</SortTh>
                {tab.type === 'imports' && <><th className="num">Goods</th><th className="num">Freight</th><th className="num">Customs</th></>}
                <SortTh k="totalUsd" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="num">Total</SortTh>
                {tab.type === 'bills' && <SortTh k="paidUsd" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="num">Paid</SortTh>}
                <SortTh k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Status</SortTh>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((d) => {
                const sym = curSymbol(d.currency, currencies);
                const outstanding = d.type === 'bill' ? d.totalUsd - (d.paidUsd || 0) : 0;
                const overdue = d.type === 'bill' && outstanding > 0.5 && (d.dueDate || '') < new Date().toISOString().slice(0, 10);
                const st = overdue && d.status !== 'paid' ? 'overdue' : d.status;
                const badge = statusBadge(st);
                const isPayment = d.type === 'supplierPayment';
                const amountUsd = (d as any).amountUsd || d.totalUsd;
                return (
                  <tr key={d.id} className="clickable" onClick={() => setDetail(d)}>
                    <td className="strong">{d.number}</td>
                    <td>{d.supplierName}</td>
                    <td className="muted">{d.date}</td>
                    <td className="muted">{isPayment ? '—' : (d.type === 'purchaseOrder' ? (d as any).expectedDate || '-' : d.dueDate || '-')}</td>
                    {tab.type === 'imports' && (
                      <>
                        <td className="num money">{fmt(d.subtotalUsd)}</td>
                        <td className="num money">{fmt(d.freightUsd || 0)}</td>
                        <td className="num money">{fmt(d.customsUsd || 0)}</td>
                      </>
                    )}
                    <td className="num money">{isPayment ? fmt(amountUsd) : fmt(d.total, sym)}{!isPayment && d.currency !== 'USD' && <span className="tiny muted"> · {fmt(d.totalUsd, '$')} USD</span>}</td>
                    {tab.type === 'bills' && <td className="num money muted">{fmt(d.paidUsd || 0)}</td>}
                    <td><Badge cls={badge.cls}><span className="badge-dot" />{badge.label}</Badge></td>
                    <td>
                      <div className="row-actions">
                        {!isPayment && editable && <button className="icon-btn" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicate(d); }}><Icon name="copy" size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!pageRows.length && <Empty icon="purchases" title={`No ${tab.label.toLowerCase()} found`} sub="Create one to get started" action={createType && editable ? <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> Create</button> : undefined} />}
        {!!pageRows.length && <Pagination page={page} size={size} total={sorted.length} onPage={go} onSize={setSize} />}
      </div>

      {creating && createType && <DocumentModal type={createType} onClose={() => setCreating(false)} onCreated={afterCreate} />}
      {detail && <DocDetail doc={detail} kind="purchase" onClose={() => setDetail(null)} onUpdated={afterCreate} />}
    </div>
  );
}
