import { useState } from 'react';
import { useData, fmt, curSymbol, today, statusBadge } from '../state';
import { useToast } from '../toast';
import { api } from '../api';
import { Modal, Field, Badge, Icon } from './ui';
import type { SalesDoc, PurchaseDoc } from '../types';

export default function DocDetail({ doc, kind, onClose, onUpdated }: { doc: SalesDoc | PurchaseDoc; kind: 'sales' | 'purchase'; onClose: () => void; onUpdated?: () => void }) {
  const { currencies, contacts } = useData();
  const toast = useToast();
  const [payOpen, setPayOpen] = useState(false);

  const sym = curSymbol(doc.currency, currencies);
  const isInvoice = doc.type === 'invoice';
  const isBill = doc.type === 'bill';
  const isPayment = doc.type === 'payment' || doc.type === 'supplierPayment';
  const outstanding = Math.max(0, (doc.totalUsd || 0) - (doc.paidUsd || 0));
  const paidPct = doc.totalUsd ? Math.min(100, ((doc.paidUsd || 0) / doc.totalUsd) * 100) : 0;
  const d = doc as any;
  const party = contacts.find((c) => c.id === d.customerId || c.id === d.supplierId);
  const lines = doc.lines || [];
  const totalUsd = doc.totalUsd || d.amountUsd || 0;

  const meta: [string, string][] = [
    ['Date', d.date],
    ...((isPayment ? [] : isInvoice || isBill ? [['Due Date', String(d.dueDate || '-')] as [string, string]] : [])),
    ...((doc.type === 'quotation' ? [['Valid Until', String(d.validUntil || '-')] as [string, string]] : [])),
    ...((doc.type === 'purchaseOrder' ? [['Expected', String(d.expectedDate || '-')] as [string, string]] : [])),
    ['Currency', `${doc.currency}${doc.fxRate ? ` (${doc.fxRate}/USD)` : ''}`],
    ['Contact', party ? `${party.name}` : String(d.customerName || d.supplierName)]
  ];

  return (
    <>
      <Modal
        size="lg"
        title={<span className="flex"><Badge cls={statusBadge(doc.status).cls}>{doc.status}</Badge> {doc.number}</span>}
        onClose={onClose}
        foot={
          <>
            {party && <span className="small muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>{party.email || party.phone}</span>}
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            {(isInvoice || isBill) && <button className="btn btn-primary" onClick={() => setPayOpen(true)}><Icon name="money" size={15} /> Record Payment</button>}
          </>
        }
      >
        <div className="doc-header" style={{ padding: '0 0 20px' }}>
          <div>
            <div className="doc-number">{doc.number}</div>
            <div className="muted small mt-8">{d.customerName || d.supplierName}</div>
            <div className="tiny muted">{party?.address ? `${party.address}, ${party.city}, ${party.country}` : ''}</div>
          </div>
          <div className="doc-meta">
            {meta.map(([k, v]) => (
              <div key={k}>
                <div className="field-label">{k}</div>
                <div className="field-val">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {isPayment ? (
          <div className="grid grid-3">
            <div className="stat teal"><div className="stat-label">Amount ({doc.currency})</div><div className="stat-value" style={{ fontSize: 20 }}>{fmt(d.amount, sym)}</div></div>
            <div className="stat amber"><div className="stat-label">USD Equivalent</div><div className="stat-value" style={{ fontSize: 20 }}>{fmt(d.amountUsd || 0)}</div></div>
            <div className="stat blue"><div className="stat-label">Applied To</div><div className="stat-value" style={{ fontSize: 20 }}>{d.invoiceId || d.billId ? 'Document' : '—'}</div></div>
          </div>
        ) : (
          <>
            {(isInvoice || isBill) && (
              <div className="mb-16">
                <div className="flex-between small mb-8">
                  <span className="muted">{paidPct >= 100 ? 'Fully paid' : `Paid ${fmt(doc.paidUsd || 0)} of ${fmt(totalUsd)}`}</span>
                  <span className="strong">{Math.round(paidPct)}%</span>
                </div>
                <div className="progress"><div style={{ width: `${paidPct}%` }} /></div>
              </div>
            )}

            <div className="table-wrap card">
              <table>
                <thead>
                  <tr><th>Item</th><th>SKU</th><th className="num">Qty</th><th className="num">Unit Price</th><th className="num">Amount</th></tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.productName}</td>
                      <td className="muted small">{l.sku}</td>
                      <td className="num">{l.qty.toLocaleString()} <span className="tiny muted">{l.unit}</span></td>
                      <td className="num money">{fmt(l.price, sym)}</td>
                      <td className="num money strong">{fmt(l.qty * l.price, sym)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={4} className="text-right muted small">Subtotal</td><td className="num money">{fmt(doc.subtotal, sym)}</td></tr>
                  {(doc.type === 'bill') && (
                    <>
                      <tr><td colSpan={4} className="text-right muted small">Freight & Shipping</td><td className="num money">{fmt((doc as any).freight || 0, sym)}</td></tr>
                      <tr><td colSpan={4} className="text-right muted small">Customs & Duties</td><td className="num money">{fmt((doc as any).customs || 0, sym)}</td></tr>
                    </>
                  )}
                  <tr className="report-total-row"><td colSpan={4} className="text-right">Total</td><td className="num">{fmt(doc.total, sym)} <span className="tiny muted">({fmt(totalUsd)} USD)</span></td></tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Modal>

      {payOpen && (
        <PaymentModal
          doc={doc}
          kind={kind}
          onClose={() => setPayOpen(false)}
          onDone={() => { setPayOpen(false); toast('Payment recorded'); onUpdated?.(); }}
        />
      )}
    </>
  );
}

function PaymentModal({ doc, kind, onClose, onDone }: { doc: SalesDoc | PurchaseDoc; kind: 'sales' | 'purchase'; onClose: () => void; onDone: () => void }) {
  const { currencies } = useData();
  const [amount, setAmount] = useState(doc.total - (doc.paidUsd || 0) * doc.fxRate);
  const [currency, setCurrency] = useState(doc.currency);
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const path = kind === 'sales' ? '/api/payments/customer' : '/api/payments/supplier';
      const idKey = kind === 'sales' ? 'invoiceId' : 'billId';
      await api.post(path, { [idKey]: doc.id, amount: +amount, currency, date });
      onDone();
      onClose();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      size="sm"
      title={`Record Payment · ${doc.number}`}
      onClose={onClose}
      foot={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</button>
      </>}
    >
      <div className="form-grid">
        <Field label="Amount">
          <input type="number" className="input" value={amount} onChange={(e) => setAmount(+e.target.value)} />
        </Field>
        <Field label="Currency">
          <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <div className="alert alert-info mt-16 small">
        <span>Receipts will be posted to the ledger and applied against this {kind === 'sales' ? 'invoice' : 'bill'}.</span>
      </div>
    </Modal>
  );
}
