import { useEffect, useMemo, useState } from 'react';
import { useData, fmt, curSymbol, today } from '../state';
import { useToast } from '../toast';
import { api } from '../api';
import { Modal, Field, Icon } from './ui';
import type { Product, LineItem } from '../types';

export type DocType = 'invoice' | 'quotation' | 'salesOrder' | 'creditNote' | 'bill' | 'purchaseOrder';

const CONFIG: Record<DocType, { title: string; kind: 'customer' | 'supplier'; api: string; extra?: string }> = {
  invoice: { title: 'New Invoice', kind: 'customer', api: '/sales' },
  quotation: { title: 'New Quotation', kind: 'customer', api: '/sales' },
  salesOrder: { title: 'New Sales Order', kind: 'customer', api: '/sales' },
  creditNote: { title: 'New Credit Note', kind: 'customer', api: '/sales' },
  bill: { title: 'New Supplier Bill', kind: 'supplier', api: '/purchases' },
  purchaseOrder: { title: 'New Purchase Order', kind: 'supplier', api: '/purchases' }
};

const PRICING: Record<DocType, 'sell' | 'cost'> = {
  invoice: 'sell', quotation: 'sell', salesOrder: 'sell', creditNote: 'sell', bill: 'cost', purchaseOrder: 'cost'
};

export default function DocumentModal({ type, onClose, onCreated }: { type: DocType; onClose: () => void; onCreated?: () => void }) {
  const { contacts, products, currencies, settings } = useData();
  const toast = useToast();
  const cfg = CONFIG[type];
  const pricing = PRICING[type];

  const partyList = useMemo(() => contacts.filter((c) => c.kind === cfg.kind && c.active), [contacts, cfg.kind]);
  const [partyId, setPartyId] = useState('');
  const party = partyList.find((c) => c.id === partyId);
  const defaultCur = settings?.preferences?.defaultCurrency || settings?.baseCurrency || 'USD';
  const [currency, setCurrency] = useState(party?.currency || defaultCur);
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [validUntil, setValidUntil] = useState(today());
  const [expectedDate, setExpectedDate] = useState(today());
  const [freightUsd, setFreightUsd] = useState(0);
  const [customsUsd, setCustomsUsd] = useState(0);
  const [taxRate, setTaxRate] = useState(settings?.tax?.rate || 0);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (party) setCurrency(party.currency);
  }, [partyId]);

  const rate = currencies.find((c) => c.code === currency)?.rate || 1;
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const tax = type === 'invoice' ? round2(subtotal * (taxRate / 100)) : 0;
  const total = subtotal + tax + (type === 'bill' ? (freightUsd + customsUsd) * rate : 0);
  const totalUsd = (subtotal + tax) / rate + (type === 'bill' ? freightUsd + customsUsd : 0);

  function addLine(product: Product) {
    setLines((ls) => {
      const existing = ls.find((l) => l.productId === product.id);
      if (existing) return ls.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { productId: product.id, productName: product.name, sku: product.sku, qty: 1, price: pricing === 'sell' ? product.price : product.cost, unit: product.unit }];
    });
  }

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    if (!party) return setErr('Select a ' + cfg.kind);
    if (!lines.length) return setErr('Add at least one line item');
    setSaving(true);
    setErr('');
    try {
      const payload: Record<string, unknown> = {
        type, customerId: party.id, supplierId: party.id,
        currency, date, lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price })),
        dueDate, validUntil, expectedDate, freightUsd: +freightUsd || 0, customsUsd: +customsUsd || 0,
        taxRate: type === 'invoice' ? taxRate / 100 : 0
      };
      await api.post(cfg.api, payload);
      toast(`Created ${cfg.title.replace('New ', '')} successfully`);
      onCreated?.();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const rateView = rate !== 1;

  return (
    <Modal
      size="lg"
      title={cfg.title}
      onClose={onClose}
      foot={<>
        {err && <span className="small" style={{ color: 'var(--danger)', marginRight: 'auto', alignSelf: 'center' }}>{err}</span>}
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          <Icon name="check" size={15} /> {saving ? 'Saving...' : 'Save & Post'}
        </button>
      </>}
    >
      <div className="form-grid">
        <Field label={cfg.kind === 'customer' ? 'Customer' : 'Supplier'}>
          <select className="select" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">Select...</option>
            {partyList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Currency">
          <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {(type === 'invoice' || type === 'bill') && (
          <Field label="Due Date">
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        )}
        {type === 'invoice' && (
          <Field label={`Tax Rate (%)${settings?.tax?.name ? ` · ${settings.tax.name}` : ''}`}>
            <input type="number" className="input" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(+e.target.value)} />
          </Field>
        )}
        {type === 'quotation' && (
          <Field label="Valid Until">
            <input type="date" className="input" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
        )}
        {(type === 'salesOrder' || type === 'purchaseOrder') && (
          <Field label="Expected Date">
            <input type="date" className="input" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </Field>
        )}
        {type === 'bill' && (
          <>
            <Field label="Freight & Shipping (USD)">
              <input type="number" className="input" min="0" value={freightUsd} onChange={(e) => setFreightUsd(+e.target.value)} />
            </Field>
            <Field label="Customs & Duties (USD)">
              <input type="number" className="input" min="0" value={customsUsd} onChange={(e) => setCustomsUsd(+e.target.value)} />
            </Field>
          </>
        )}
      </div>

      <div className="flex-between mt-16 mb-8">
        <div className="card-title">Line Items</div>
        <select className="select input-sm" style={{ width: 260 }} value="" onChange={(e) => { const p = products.find((x) => x.id === e.target.value); if (p) addLine(p); }}>
          <option value="">+ Add product...</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
        </select>
      </div>

      {lines.length === 0 ? (
        <div className="empty" style={{ padding: 28 }}>
          <div className="empty-icon" style={{ width: 40, height: 40 }}><Icon name="box" size={18} /></div>
          <div className="empty-title">No items yet</div>
          <div className="small">Pick a glove product from the list above to add it</div>
        </div>
      ) : (
        <div className="table-wrap card">
          <table className="line-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Product</th>
                <th style={{ width: 90 }}>Qty</th>
                <th style={{ width: 120 }}>Unit Price</th>
                <th style={{ width: 120 }} className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td><button className="btn btn-ghost btn-xs" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}><Icon name="x" size={13} /></button></td>
                  <td>
                    <div className="strong small">{l.productName}</div>
                    <div className="tiny muted">{l.sku} · {l.unit}</div>
                  </td>
                  <td><input type="number" className="input input-sm" min="0" value={l.qty} onChange={(e) => updateLine(i, { qty: Math.max(0, +e.target.value) })} /></td>
                  <td>
                    <div className="flex" style={{ gap: 4 }}>
                      <input type="number" className="input input-sm" min="0" step="0.01" value={l.price} onChange={(e) => updateLine(i, { price: +e.target.value })} />
                      <span className="tiny muted">{currency}</span>
                    </div>
                  </td>
                  <td className="num strong money">{fmt(l.qty * l.price, curSymbol(currency, currencies))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex" style={{ justifyContent: 'flex-end', marginTop: 16, gap: 24 }}>
        <div className="text-right">
          <div className="tiny muted">Subtotal ({currency})</div>
          <div className="strong money" style={{ fontSize: 15 }}>{fmt(subtotal, curSymbol(currency, currencies))}</div>
          {rateView && <div className="tiny muted">= {fmt(subtotal / rate, '$')} USD</div>}
        </div>
        {type === 'invoice' && (
          <div className="text-right">
            <div className="tiny muted">Tax ({taxRate}%)</div>
            <div className="strong money" style={{ fontSize: 15 }}>{fmt(tax, curSymbol(currency, currencies))}</div>
          </div>
        )}
        <div className="text-right">
          <div className="tiny muted">Total</div>
          <div className="strong money" style={{ fontSize: 19 }}>{fmt(total, curSymbol(currency, currencies))}</div>
          {rateView && <div className="tiny muted">= {fmt(totalUsd, '$')} USD</div>}
        </div>
      </div>
    </Modal>
  );
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
