import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData, fmt, fmtQty, today } from '../state';
import { useToast } from '../toast';
import { api } from '../api';
import { PageHead, Icon, Modal, Field, Empty } from '../components/ui';
import type { Product, SalesDoc, PurchaseDoc, JournalEntry } from '../types';

const CATS = ['All', 'Disposable', 'Work', 'Cut-Resistant', 'Leather', 'Welding', 'Winter', 'Knit', 'Household', 'Chemical'];

export default function Products() {
  const { products, sales, purchases, journal, refresh } = useData();
  const toast = useToast();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [cat, setCat] = useState('All');
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [history, setHistory] = useState<Product | null>(null);

  const filtered = useMemo(() => products.filter((p) =>
    (cat === 'All' || p.category === cat) &&
    (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()))
  ), [products, cat, q]);

  const totalValue = products.reduce((s, p) => s + p.qty * p.cost, 0);
  const totalRetail = products.reduce((s, p) => s + p.qty * p.price, 0);
  const totalUnits = products.reduce((s, p) => s + p.qty, 0);
  const lowCount = products.filter((p) => p.qty <= p.reorder).length;

  async function saveProduct(p: Partial<Product>) {
    try {
      if (editing) await api.put(`/products/${editing.id}`, p);
      else await api.post('/products', p);
      toast(editing ? 'Product updated' : 'Product created');
      await refresh();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const lowPct = (p: Product) => Math.min(100, (p.qty / Math.max(p.reorder * 2, 1)) * 100);

  return (
    <div>
      <PageHead
        title="Products & Stock"
        sub={`${products.length} glove SKUs across ${CATS.length - 1} categories`}
        actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setCreating(true); }}><Icon name="plus" size={15} /> New Product</button>}
      />

      <div className="grid grid-4 mb-16">
        <div className="card card-pad"><div className="tiny muted">Units on Hand</div><div className="strong" style={{ fontSize: 22 }}>{fmtQty(totalUnits)}</div></div>
        <div className="card card-pad"><div className="tiny muted">Inventory Cost Value</div><div className="strong" style={{ fontSize: 22 }}>{fmt(totalValue)}</div></div>
        <div className="card card-pad"><div className="tiny muted">Retail Value</div><div className="strong" style={{ fontSize: 22 }}>{fmt(totalRetail)}</div></div>
        <div className="card card-pad"><div className="tiny muted">Below Reorder Point</div><div className="strong" style={{ fontSize: 22, color: lowCount ? 'var(--danger)' : 'var(--success)' }}>{lowCount}</div></div>
      </div>

      <div className="toolbar">
        <div className="seg">
          {CATS.map((c) => <button key={c} className={c === cat ? 'active' : ''} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div className="grow" />
        <div className="search-box"><Icon name="search" size={14} /><input placeholder="Search by name or SKU..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      {filtered.length ? (
        <div className="product-grid">
          {filtered.map((p) => {
            const low = p.qty <= p.reorder;
            return (
              <div className="product-card" key={p.id} onClick={() => { setCreating(true); setEditing(p); }}>
                <div className="flex-between">
                  <span className="product-cat">{p.category}</span>
                  <span className="flex" style={{ gap: 4 }}>
                    <button className="icon-btn" title="Stock movement history" onClick={(e) => { e.stopPropagation(); setHistory(p); }}><Icon name="history" size={14} /></button>
                    <span className="tiny muted">{p.sku}</span>
                  </span>
                </div>
                <div className="product-name">{p.name}</div>
                <div className="product-meta">{p.material} · Size {p.size} · {p.color} · {p.unit}{p.imported ? ` · Imported (${p.origin})` : ` · Local (${p.origin})`}</div>
                <div className="stock-row">
                  <div>
                    <span className="strong" style={{ fontSize: 16 }}>{fmtQty(p.qty)}</span>
                    <span className="tiny muted"> in stock</span>
                    <div className="tiny" style={{ color: low ? 'var(--danger)' : 'var(--text-3)' }}>{low ? `Reorder at ${fmtQty(p.reorder)}` : `Reorder at ${fmtQty(p.reorder)}`}</div>
                  </div>
                  <span className="price-tag">{fmt(p.price)}</span>
                </div>
                <div className="stock-bar"><div style={{ width: `${lowPct(p)}%`, background: low ? 'var(--danger)' : 'var(--primary-2)' }} /></div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty icon="box" title="No products match" sub="Try a different category or search term" />
      )}

      {(creating || editing) && (
        <ProductModal
          product={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={saveProduct}
        />
      )}
      {history && <HistoryModal product={history} sales={sales} purchases={purchases} journal={journal} onClose={() => setHistory(null)} />}
    </div>
  );
}

type Move = { date: string; ref: string; type: string; qty: number; value: number; _qty?: number };

function HistoryModal({ product, sales, purchases, journal, onClose }: { product: Product; sales: SalesDoc[]; purchases: PurchaseDoc[]; journal: JournalEntry[]; onClose: () => void }) {
  const moves = useMemo(() => {
    const out: Move[] = [];
    for (const s of sales) {
      if (s.type !== 'invoice') continue;
      const line = (s.lines || []).find((l) => l.productId === product.id);
      if (line) out.push({ date: s.date, ref: s.number, type: 'Sold', qty: -line.qty, value: line.qty * line.price });
    }
    for (const p of purchases) {
      if (p.type !== 'bill') continue;
      const line = (p.lines || []).find((l) => l.productId === product.id);
      if (line) out.push({ date: p.date, ref: p.number, type: 'Received', qty: line.qty, value: line.qty * line.price });
    }
    for (const je of journal) {
      if (je.docType !== 'stockAdjustment' || je.ref !== product.sku) continue;
      const inv = (je.lines || []).find((l) => l.accountId === 'inventory');
      const delta = (inv?.debit || 0) - (inv?.credit || 0);
      out.push({ date: je.date, ref: je.ref, type: je.memo.includes('Opening') ? 'Opening' : 'Adjustment', qty: 0, value: delta });
    }
    out.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
    let running = 0;
    for (const m of out) { running += m.qty; m['_qty'] = running; }
    return out;
  }, [product, sales, purchases, journal]);

  const onHand = product.qty;

  return (
    <Modal size="lg" title={`Stock Movement · ${product.sku}`} onClose={onClose}
      foot={<><span className="tiny muted grow">Units on hand now</span><span className="strong" style={{ fontSize: 18 }}>{fmtQty(onHand)}</span></>}>
      <div className="strong mb-8">{product.name}</div>
      <div className="tiny muted mb-16">{product.material} · Size {product.size} · {product.unit} · Cost {fmt(product.cost)} · Sell {fmt(product.price)}</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Reference</th><th>Type</th><th className="num">In</th><th className="num">Out</th><th className="num">On Hand</th><th className="num">Value (USD)</th></tr></thead>
          <tbody>
            {moves.map((m, i) => (
              <tr key={i}>
                <td className="muted">{m.date}</td>
                <td className="strong small">{m.ref}</td>
                <td><span className="badge badge-gray">{m.type}</span></td>
                <td className="num money" style={{ color: 'var(--success)' }}>{m.qty > 0 ? fmtQty(m.qty) : ''}</td>
                <td className="num money" style={{ color: 'var(--danger)' }}>{m.qty < 0 ? fmtQty(Math.abs(m.qty)) : ''}</td>
                <td className="num money muted">{fmtQty(m._qty || 0)}</td>
                <td className="num money">{fmt(Math.abs(m.value))}</td>
              </tr>
            ))}
            {!moves.length && <tr><td colSpan={7} className="muted small" style={{ textAlign: 'center', padding: 20 }}>No stock movements recorded</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function ProductModal({ product, onClose, onSave }: { product: Product | null; onClose: () => void; onSave: (p: Partial<Product>) => void }) {
  const [form, setForm] = useState<Partial<Product>>(
    product || { name: '', sku: `GLV-${Date.now().toString(36).toUpperCase()}`, category: 'Work', material: '', size: 'M', color: '', unit: 'Pair', cost: 0, price: 0, qty: 0, reorder: 100, imported: true, origin: 'China' }
  );
  const set = (k: keyof Product, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      title={product ? `Edit ${product.name}` : 'New Product'}
      onClose={onClose}
      foot={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave(form)}>Save Product</button>
      </>}
    >
      <div className="form-grid">
        <Field label="Product Name"><input className="input" value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Nitrile Exam Gloves" /></Field>
        <Field label="SKU"><input className="input" value={form.sku || ''} onChange={(e) => set('sku', e.target.value)} /></Field>
        <Field label="Category">
          <select className="select" value={form.category || 'Work'} onChange={(e) => set('category', e.target.value)}>
            {['Disposable', 'Work', 'Cut-Resistant', 'Leather', 'Welding', 'Winter', 'Knit', 'Household', 'Chemical'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Material"><input className="input" value={form.material || ''} onChange={(e) => set('material', e.target.value)} placeholder="Nitrile, Cotton, Leather..." /></Field>
        <Field label="Size"><input className="input" value={form.size || ''} onChange={(e) => set('size', e.target.value)} /></Field>
        <Field label="Color"><input className="input" value={form.color || ''} onChange={(e) => set('color', e.target.value)} /></Field>
        <Field label="Unit">
          <select className="select" value={form.unit || 'Pair'} onChange={(e) => set('unit', e.target.value)}>
            {['Pair', 'Dozen', 'Box/100', 'Box/50', 'Box'].map((u) => <option key={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Origin"><input className="input" value={form.origin || ''} onChange={(e) => set('origin', e.target.value)} /></Field>
        <Field label="Cost Price (USD)"><input type="number" className="input" step="0.01" value={form.cost || 0} onChange={(e) => set('cost', +e.target.value)} /></Field>
        <Field label="Sell Price (USD)"><input type="number" className="input" step="0.01" value={form.price || 0} onChange={(e) => set('price', +e.target.value)} /></Field>
        <Field label="Opening Stock (units)"><input type="number" className="input" value={form.qty || 0} onChange={(e) => set('qty', +e.target.value)} /></Field>
        <Field label="Reorder Point"><input type="number" className="input" value={form.reorder || 0} onChange={(e) => set('reorder', +e.target.value)} /></Field>
      </div>
      <div className="flex mt-16">
        <label className="flex small" style={{ gap: 8 }}>
          <input type="checkbox" checked={!!form.imported} onChange={(e) => set('imported', e.target.checked)} />
          Imported product
        </label>
      </div>
    </Modal>
  );
}
