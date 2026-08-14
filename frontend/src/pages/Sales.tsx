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
import type { SalesDoc } from '../types';

const TABS: { key: string; label: string; type: string }[] = [
  { key: 'quotations', label: 'Quotations', type: 'quotation' },
  { key: 'orders', label: 'Sales Orders', type: 'salesOrder' },
  { key: 'invoices', label: 'Invoices', type: 'invoice' },
  { key: 'credit-notes', label: 'Credit Notes', type: 'creditNote' },
  { key: 'payments', label: 'Customer Payments', type: 'payment' }
];

export default function Sales() {
  const { docType } = useParams();
  const navigate = useNavigate();
  const { sales, currencies, refresh, refreshDashboard } = useData();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<SalesDoc | null>(null);
  const toast = useToast();
  const editable = canEdit(user);

  const tab = TABS.find((t) => t.key === docType) || TABS[2];
  const createType = tab.type === 'payment' ? null : (tab.type as DocType);

  const base = useMemo(() => {
    return tab.type === 'payment'
      ? sales.filter((d) => d.type === 'payment')
      : sales.filter((d) => d.type === tab.type);
  }, [sales, tab]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return base;
    return base.filter((d) => d.number.toLowerCase().includes(t) || d.customerName.toLowerCase().includes(t));
  }, [base, q]);

  const { sortKey, sortDir, toggle, apply } = useSort<SalesDoc>('date', 'desc');
  const sorted = useMemo(() => apply(filtered), [apply, filtered]);
  const { page, size, go, setSize, reset, slice } = usePagination<SalesDoc>(10);
  const pageRows = useMemo(() => slice(sorted), [slice, sorted]);

  useEffect(() => { reset(); }, [tab, reset]);

  async function afterCreate() {
    await refresh();
    await refreshDashboard();
  }

  async function duplicate(d: SalesDoc) {
    try {
      await api.post(`/sales/${d.id}/duplicate`, {});
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
        sub="Quotes, orders, invoices and receipts"
        actions={<>
          <button className="btn btn-secondary no-print" onClick={() => window.print()}><Icon name="printer" size={15} /> Print</button>
          {editable && <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> New {tab.label.replace('Customer ', '')}</button>}
        </>}
      />

      <div className="toolbar no-print">
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`tab ${t.key === tab.key ? 'active' : ''}`} onClick={() => navigate(`/sales/${t.key}`)}>{t.label}</button>
          ))}
        </div>
        <div className="grow" />
        <FilterBar query={q} onQuery={(v) => { setQ(v); reset(); }} placeholder="Search by number or customer..." />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh k="number" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Number</SortTh>
                <SortTh k="customerName" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Customer</SortTh>
                <SortTh k="date" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Date</SortTh>
                <SortTh k="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Due / Valid</SortTh>
                <SortTh k="totalUsd" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="num">Total</SortTh>
                <SortTh k="paidUsd" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="num">Paid</SortTh>
                <SortTh k="totalUsd" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="num">Outstanding</SortTh>
                <SortTh k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Status</SortTh>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((d) => {
                const sym = curSymbol(d.currency, currencies);
                const outstanding = tab.type === 'invoice' ? d.totalUsd - (d.paidUsd || 0) : 0;
                const overdue = tab.type === 'invoice' && outstanding > 0.5 && (d.dueDate || '') < new Date().toISOString().slice(0, 10);
                const st = overdue && d.status !== 'paid' ? 'overdue' : d.status;
                const badge = statusBadge(st);
                const isPayment = d.type === 'payment';
                const amountUsd = d.amountUsd || d.totalUsd;
                return (
                  <tr key={d.id} className="clickable" onClick={() => setDetail(d)}>
                    <td className="strong">{d.number}</td>
                    <td>{d.customerName}</td>
                    <td className="muted">{d.date}</td>
                    <td className="muted">{isPayment ? '—' : (tab.type === 'quotation' ? (d as any).validUntil || '-' : d.dueDate || '-')}</td>
                    <td className="num money">{isPayment ? fmt(amountUsd) : fmt(d.total, sym)}{!isPayment && d.currency !== 'USD' && <span className="tiny muted"> · {fmt(d.totalUsd, '$')} USD</span>}</td>
                    <td className="num money muted">{tab.type === 'invoice' ? fmt(d.paidUsd || 0) : (isPayment ? fmt(amountUsd) : '—')}</td>
                    <td className="num money strong">{tab.type === 'invoice' ? fmt(outstanding) : '—'}</td>
                    <td><Badge cls={badge.cls}><span className="badge-dot" />{badge.label}</Badge></td>
                    <td>
                      <div className="row-actions">
                        {editable && (
                          <button className="icon-btn" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicate(d); }}><Icon name="copy" size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!pageRows.length && <Empty icon={tab.type === 'payment' ? 'wallet' : 'doc'} title={`No ${tab.label.toLowerCase()} found`} sub="Create one to get started" action={createType && editable ? <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> Create</button> : undefined} />}
        {!!pageRows.length && <Pagination page={page} size={size} total={sorted.length} onPage={go} onSize={setSize} />}
      </div>

      {creating && createType && <DocumentModal type={createType} onClose={() => setCreating(false)} onCreated={afterCreate} />}
      {detail && <DocDetail doc={detail} kind="sales" onClose={() => setDetail(null)} onUpdated={afterCreate} />}
    </div>
  );
}
