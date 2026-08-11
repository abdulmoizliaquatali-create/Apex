import { useState } from 'react';
import { useData, fmt, curSymbol, today, statusBadge } from '../state';
import { useToast } from '../toast';
import { api } from '../api';
import { Modal, Field, Badge, Icon, Loader } from './ui';
import { downloadDocPdf } from '../utils/pdf';
import type { SalesDoc, PurchaseDoc } from '../types';

export default function DocDetail({ doc, kind, onClose, onUpdated }: { doc: SalesDoc | PurchaseDoc; kind: 'sales' | 'purchase'; onClose: () => void; onUpdated?: () => void }) {
  const { currencies, contacts, bankAccounts, settings } = useData();
  const toast = useToast();
  const [payOpen, setPayOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState('');

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

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try {
      const res = await fn();
      const r = res as any;
      if (r && r.error) throw new Error(r.error);
      toast(label);
      onUpdated?.();
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function convert(to: 'salesOrder' | 'invoice') {
    await run(`Converted ${doc.number} to ${to === 'invoice' ? 'an invoice' : 'a sales order'}`, () => api.post(`/sales/${doc.id}/convert`, { to }));
  }

  async function markSent() {
    await run(`Marked ${doc.number} as sent`, () => api.post(`/sales/${doc.id}/status`, { status: 'sent' }));
  }

  async function cancel() {
    await run(`Voided ${doc.number}`, () => api.post(`/${kind}/${doc.id}/status`, { status: 'cancelled' }));
  }

  function downloadPdf() {
    try {
      downloadDocPdf(doc, party, settings).then(() => toast('PDF downloaded'));
    } catch (e) {
      toast('PDF export failed: ' + (e as Error).message, 'error');
    }
  }

  const meta: [string, string][] = [
    ['Date', d.date],
    ...((isPayment ? [] : isInvoice || isBill ? [['Due Date', String(d.dueDate || '-')] as [string, string]] : [])),
    ...((doc.type === 'quotation' ? [['Valid Until', String(d.validUntil || '-')] as [string, string]] : [])),
    ...((doc.type === 'purchaseOrder' ? [['Expected', String(d.expectedDate || '-')] as [string, string]] : [])),
    ['Currency', `${doc.currency}${doc.fxRate ? ` (${doc.fxRate}/USD)` : ''}`],
    ['Contact', party ? `${party.name}` : String(d.customerName || d.supplierName)]
  ];

  // Workflow actions available for this document.
  const actions: { key: string; label: string; icon: string; onClick: () => void; danger?: boolean }[] = [];
  if (doc.type === 'quotation' && doc.status === 'draft') actions.push({ key: 'sent', label: 'Mark as Sent', icon: 'check', onClick: markSent });
  if ((doc.type === 'quotation' || doc.type === 'salesOrder') && doc.status !== 'converted' && doc.status !== 'cancelled') {
    if (doc.type === 'quotation') actions.push({ key: 'so', label: 'Convert to Sales Order', icon: 'copy', onClick: () => convert('salesOrder') });
    actions.push({ key: 'inv', label: 'Convert to Invoice', icon: 'money', onClick: () => convert('invoice') });
  }
  if (doc.type === 'purchaseOrder' && doc.status !== 'received' && doc.status !== 'cancelled') {
    actions.push({ key: 'recv', label: 'Receive Goods & Create Bill', icon: 'upload', onClick: () => setReceiveOpen(true) });
  }
  if ((isInvoice || isBill) && doc.status !== 'cancelled') actions.push({ key: 'pay', label: 'Record Payment', icon: 'money', onClick: () => setPayOpen(true) });
  if (doc.status !== 'cancelled' && doc.type !== 'payment' && doc.type !== 'supplierPayment') {
    actions.push({ key: 'cancel', label: 'Void / Cancel', icon: 'trash', onClick: () => setConfirmCancel(true), danger: true });
  }

  return (
    <>
      <Modal
        size="lg"
        title={<span className="flex"><Badge cls={statusBadge(doc.status).cls}>{doc.status}</Badge> {doc.number}</span>}
        onClose={onClose}
        foot={
          <>
            {party && <span className="small muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>{party.email || party.phone}</span>}
            <button className="btn btn-secondary" onClick={downloadPdf}><Icon name="printer" size={15} /> PDF</button>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            {actions.map((a) => (
              <button key={a.key} className={`btn ${a.danger ? 'btn-danger' : 'btn-primary'}`} onClick={a.onClick} disabled={busy !== ''}>
                {busy === a.key ? <Loader size={14} light /> : <Icon name={a.icon} size={15} />} {a.label}
              </button>
            ))}
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
            <div className="stat amber"><div className="stat-label">In {settings?.baseCurrency || 'USD'}</div><div className="stat-value" style={{ fontSize: 20 }}>{fmt(d.amountUsd || 0)}</div></div>
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
                  <tr className="report-total-row"><td colSpan={4} className="text-right">Total</td><td className="num">{fmt(doc.total, sym)} <span className="tiny muted">({fmt(totalUsd, '$')} USD)</span></td></tr>
                </tfoot>
              </table>
            </div>

            {actions.length > 0 && (
              <div className="alert alert-info small mt-16" style={{ marginTop: 16 }}>
                <Icon name="trend" size={15} />
                <span>{doc.type === 'purchaseOrder' ? 'Receive the goods to create the supplier bill automatically.' : doc.type === 'quotation' ? 'Keep the ball rolling — convert this quotation into an order or invoice instead of typing it all again.' : 'Document is live and posting to the ledger.'}</span>
              </div>
            )}
          </>
        )}
      </Modal>

      {payOpen && (
        <PaymentModal
          doc={doc}
          kind={kind}
          bankAccounts={bankAccounts}
          defaultBank={settings?.preferences?.receiptBankAccountId || settings?.preferences?.paymentBankAccountId}
          onClose={() => setPayOpen(false)}
          onDone={() => { setPayOpen(false); toast('Payment recorded'); onUpdated?.(); }}
        />
      )}

      {receiveOpen && (
        <ReceiveModal
          doc={doc}
          defaultDue={settings?.preferences?.billDueDays}
          onClose={() => setReceiveOpen(false)}
          onDone={(msg) => { setReceiveOpen(false); toast(msg); onUpdated?.(); }}
        />
      )}

      {confirmCancel && (
        <Modal
          size="sm"
          title={`Void ${doc.number}?`}
          onClose={() => setConfirmCancel(false)}
          foot={<>
            <button className="btn btn-secondary" onClick={() => setConfirmCancel(false)}>Keep it</button>
            <button className="btn btn-danger" onClick={cancel} disabled={busy === 'cancel'}>{busy === 'cancel' ? <Loader size={14} light /> : <Icon name="trash" size={14} />} Yes, void it</button>
          </>}
        >
          <p className="small">
            {doc.type === 'purchaseOrder' ? 'This will mark the purchase order as cancelled. Nothing is posted to the ledger.' :
             doc.type === 'quotation' || doc.type === 'salesOrder' ? 'This will cancel the document. No ledger entries are affected.' :
             'This reverses every ledger posting made by this document (and any linked payments) and restores stock. The voided entry remains in the journal for audit.'}
          </p>
        </Modal>
      )}
    </>
  );
}

function PaymentModal({ doc, kind, bankAccounts, defaultBank, onClose, onDone }: { doc: SalesDoc | PurchaseDoc; kind: 'sales' | 'purchase'; bankAccounts: { id: string; name: string }[]; defaultBank?: string; onClose: () => void; onDone: () => void }) {
  const { currencies } = useData();
  const toast = useToast();
  const [amount, setAmount] = useState(doc.total - (doc.paidUsd || 0) * doc.fxRate);
  const [currency, setCurrency] = useState(doc.currency);
  const [date, setDate] = useState(today());
  const [bankAccountId, setBankAccountId] = useState(defaultBank || bankAccounts[0]?.id || 'ba1');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const path = kind === 'sales' ? '/payments/customer' : '/payments/supplier';
      const idKey = kind === 'sales' ? 'invoiceId' : 'billId';
      await api.post(path, { [idKey]: doc.id, amount: +amount, currency, date, bankAccountId });
      onDone();
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
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
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? <Loader size={14} light /> : 'Record Payment'}</button>
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
        <Field label="Bank Account">
          <select className="select" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
            {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="alert alert-info mt-16 small">
        <span>Receipts will be posted to the ledger and applied against this {kind === 'sales' ? 'invoice' : 'bill'}.</span>
      </div>
    </Modal>
  );
}

function ReceiveModal({ doc, defaultDue, onClose, onDone }: { doc: SalesDoc | PurchaseDoc; defaultDue?: number; onClose: () => void; onDone: (msg: string) => void }) {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [freight, setFreight] = useState(0);
  const [customs, setCustoms] = useState(0);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await api.post(`/purchases/${doc.id}/receive`, { date, dueDate, freightUsd: +freight || 0, customsUsd: +customs || 0 });
      onDone(`Received goods — bill ${(res as any).number} created`);
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      size="sm"
      title={`Receive Goods · ${doc.number}`}
      onClose={onClose}
      foot={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? <Loader size={14} light /> : 'Receive Goods'}</button>
      </>}
    >
      <p className="small muted mb-16">Confirms receipt of the ordered stock and creates the supplier bill. Landing costs (freight & customs) are optional — add them if known, or edit the bill afterwards.</p>
      <div className="form-grid">
        <Field label="Received Date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Due Date"><input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        <Field label="Freight & Shipping (USD)"><input type="number" className="input" min="0" value={freight} onChange={(e) => setFreight(+e.target.value)} /></Field>
        <Field label="Customs & Duties (USD)"><input type="number" className="input" min="0" value={customs} onChange={(e) => setCustoms(+e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
