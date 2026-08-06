import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useData, fmt, curSymbol } from '../state';
import { useToast } from '../toast';
import { api } from '../api';
import { PageHead, Icon, Modal, Field, Badge, Empty } from '../components/ui';
import type { Contact, SalesDoc, PurchaseDoc } from '../types';

export default function Contacts() {
  const { kind } = useParams();
  const navigate = useNavigate();
  const { contacts, sales, purchases, currencies, refresh } = useData();
  const toast = useToast();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [modal, setModal] = useState<{ open: boolean; contact: Contact | null }>({ open: false, contact: null });
  const [stmt, setStmt] = useState<Contact | null>(null);

  const isCustomer = kind === 'customers';
  const list = useMemo(() => contacts
    .filter((c) => c.kind === (isCustomer ? 'customer' : 'supplier'))
    .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.country.toLowerCase().includes(q.toLowerCase()))
    .map((c) => {
      const docs = isCustomer ? sales.filter((d) => d.type === 'invoice' && d.customerId === c.id) : purchases.filter((d) => d.type === 'bill' && d.supplierId === c.id);
      const outstanding = docs.reduce((s, d) => s + (d.totalUsd - (d.paidUsd || 0)), 0);
      const total = docs.reduce((s, d) => s + d.totalUsd, 0);
      return { ...c, outstanding: Math.max(0, outstanding), total, docCount: docs.length };
    })
    .sort((a, b) => b.total - a.total), [contacts, sales, purchases, isCustomer, q]);

  const totalOutstanding = list.reduce((s, c) => s + c.outstanding, 0);
  const totalVolume = list.reduce((s, c) => s + c.total, 0);

  async function saveContact(c: Partial<Contact>) {
    try {
      if (modal.contact) await api.put(`/contacts/${modal.contact.id}`, c);
      else await api.post('/contacts', c);
      toast(modal.contact ? 'Contact updated' : 'Contact created');
      await refresh();
      setModal({ open: false, contact: null });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <div>
      <PageHead
        title={isCustomer ? 'Customers' : 'Suppliers'}
        sub={isCustomer ? 'Local & international glove buyers' : 'Local manufacturers & overseas factories'}
        actions={<button className="btn btn-primary" onClick={() => setModal({ open: true, contact: null })}><Icon name="plus" size={15} /> New {isCustomer ? 'Customer' : 'Supplier'}</button>}
      />

      <div className="grid grid-3 mb-16">
        <div className="card card-pad"><div className="tiny muted">Total {isCustomer ? 'Customers' : 'Suppliers'}</div><div className="strong" style={{ fontSize: 22 }}>{list.length}</div></div>
        <div className="card card-pad"><div className="tiny muted">{isCustomer ? 'Outstanding Receivables' : 'Outstanding Payables'}</div><div className="strong" style={{ fontSize: 22 }}>{fmt(totalOutstanding)}</div></div>
        <div className="card card-pad"><div className="tiny muted">{isCustomer ? 'Lifetime Sales' : 'Lifetime Purchases'}</div><div className="strong" style={{ fontSize: 22 }}>{fmt(totalVolume)}</div></div>
      </div>

      <div className="toolbar">
        <div className="tabs">
          <button className={`tab ${isCustomer ? 'active' : ''}`} onClick={() => navigate('/contacts/customers')}>Customers</button>
          <button className={`tab ${!isCustomer ? 'active' : ''}`} onClick={() => navigate('/contacts/suppliers')}>Suppliers</button>
        </div>
        <div className="grow" />
        <div className="search-box"><Icon name="search" size={14} /><input placeholder="Search by name or country..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Contact</th><th>Location</th><th>Type</th><th>Currency</th>
                <th className="num">{isCustomer ? 'Volume' : 'Volume'}</th>
                <th className="num">Outstanding</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="flex" style={{ gap: 10 }}>
                      <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{c.name.slice(0, 1)}</div>
                      <div>
                        <div className="strong small">{c.name}</div>
                        <div className="tiny muted">{c.person}</div>
                      </div>
                    </div>
                  </td>
                  <td className="small muted">{c.email}<div>{c.phone}</div></td>
                  <td className="small">{c.city}, {c.country}</td>
                  <td><span className="badge badge-gray">{c.type || (isCustomer ? 'Buyer' : 'Supplier')}</span></td>
                  <td>{c.currency}</td>
                  <td className="num money">{fmt(c.total)}</td>
                  <td className={`num money ${c.outstanding > 0 ? 'strong' : 'muted'}`}>{fmt(c.outstanding)}</td>
                  <td>{c.active ? <Badge cls="badge-green"><span className="badge-dot" />Active</Badge> : <Badge cls="badge-gray">Inactive</Badge>}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" title="Statement" onClick={() => setStmt(c)}><Icon name="statement" size={14} /></button>
                      <button className="btn btn-ghost btn-xs" onClick={() => setModal({ open: true, contact: c })}><Icon name="edit" size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length && <Empty icon={isCustomer ? 'customers' : 'suppliers'} title={`No ${isCustomer ? 'customers' : 'suppliers'} yet`} sub="Add one to start trading" />}
      </div>

      {modal.open && (
        <ContactModal contact={modal.contact} isCustomer={isCustomer} currencies={currencies} onClose={() => setModal({ open: false, contact: null })} onSave={saveContact} />
      )}
      {stmt && <StatementModal contact={stmt} sales={sales} purchases={purchases} isCustomer={isCustomer} onClose={() => setStmt(null)} />}
    </div>
  );
}

type StmtRow = { date: string; number: string; desc: string; debit: number; credit: number; _bal?: number };

function StatementModal({ contact, sales, purchases, isCustomer, onClose }: { contact: Contact; sales: SalesDoc[]; purchases: PurchaseDoc[]; isCustomer: boolean; onClose: () => void }) {
  const rows = useMemo<StmtRow[]>(() => {
    const out: StmtRow[] = [];
    if (isCustomer) {
      for (const d of sales) {
        if (d.customerId !== contact.id) continue;
        if (d.type === 'invoice') out.push({ date: d.date, number: d.number, desc: `Invoice · ${d.customerName}`, debit: d.totalUsd, credit: 0 });
        else if (d.type === 'creditNote') out.push({ date: d.date, number: d.number, desc: `Credit note · ${d.customerName}`, debit: 0, credit: d.totalUsd });
        else if (d.type === 'payment') out.push({ date: d.date, number: d.number, desc: `Payment received · ${d.customerName}`, debit: 0, credit: d.amountUsd || 0 });
      }
    } else {
      for (const d of purchases) {
        if (d.supplierId !== contact.id) continue;
        if (d.type === 'bill') out.push({ date: d.date, number: d.number, desc: `Bill · ${d.supplierName}`, debit: d.totalUsd, credit: 0 });
        else if (d.type === 'supplierPayment') out.push({ date: d.date, number: d.number, desc: `Payment sent · ${d.supplierName}`, debit: 0, credit: (d as { amountUsd?: number }).amountUsd || 0 });
      }
    }
    out.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
    let bal = 0;
    for (const r of out) { bal += r.debit - r.credit; r['_bal'] = bal; }
    return out;
  }, [contact, sales, purchases, isCustomer]);

  const balance = rows.length ? rows[rows.length - 1]['_bal'] || 0 : 0;

  return (
    <Modal size="lg" title={`Statement · ${contact.name}`} onClose={onClose}
      foot={<><span className="tiny muted grow">Outstanding {isCustomer ? 'receivable' : 'payable'}</span><span className="strong" style={{ fontSize: 18 }}>{fmt(balance)}</span></>}>
      <div className="tiny muted mb-16">{contact.city}, {contact.country} · {contact.email} · {isCustomer ? 'Customer' : 'Supplier'}</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Reference</th><th>Description</th><th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="muted">{r.date}</td>
                <td className="strong small">{r.number}</td>
                <td className="small">{r.desc}</td>
                <td className="num money">{r.debit ? fmt(r.debit) : ''}</td>
                <td className="num money">{r.credit ? fmt(r.credit) : ''}</td>
                <td className="num money muted">{fmt(r['_bal'] || 0)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="muted small" style={{ textAlign: 'center', padding: 20 }}>No transactions yet</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function ContactModal({ contact, isCustomer, currencies, onClose, onSave }: { contact: Contact | null; isCustomer: boolean; currencies: { code: string; name: string }[]; onClose: () => void; onSave: (c: Partial<Contact>) => void }) {
  const [f, setF] = useState<Partial<Contact>>(contact || { kind: isCustomer ? 'customer' : 'supplier', name: '', person: '', email: '', phone: '', address: '', city: '', country: '', currency: 'USD', type: isCustomer ? 'Distributor' : 'Overseas Factory', creditLimit: 0, active: true });
  const set = (k: keyof Contact, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal
      size="lg"
      title={contact ? `Edit ${contact.name}` : `New ${isCustomer ? 'Customer' : 'Supplier'}`}
      onClose={onClose}
      foot={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave(f)}>Save</button>
      </>}
    >
      <div className="form-grid">
        <Field label="Company Name"><input className="input" value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Contact Person"><input className="input" value={f.person || ''} onChange={(e) => set('person', e.target.value)} /></Field>
        <Field label="Email"><input className="input" value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Phone"><input className="input" value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Address"><input className="input" value={f.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="City"><input className="input" value={f.city || ''} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="Country"><input className="input" value={f.country || ''} onChange={(e) => set('country', e.target.value)} /></Field>
        <Field label="Currency">
          <select className="select" value={f.currency} onChange={(e) => set('currency', e.target.value)}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
          </select>
        </Field>
        <Field label={isCustomer ? 'Customer Type' : 'Supplier Type'}>
          <input className="input" value={f.type || ''} onChange={(e) => set('type', e.target.value)} placeholder={isCustomer ? 'Importer, Distributor, Wholesaler...' : 'Overseas Factory, Local Manufacturer...'} />
        </Field>
        {isCustomer && <Field label="Credit Limit (USD)"><input type="number" className="input" value={f.creditLimit || 0} onChange={(e) => set('creditLimit', +e.target.value)} /></Field>}
      </div>
    </Modal>
  );
}
