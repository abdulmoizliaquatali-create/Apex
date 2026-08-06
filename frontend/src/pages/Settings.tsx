import { useState } from 'react';
import { useData, today } from '../state';
import { useToast } from '../toast';
import { api } from '../api';
import { PageHead, Icon, Field, Modal } from '../components/ui';

export default function Settings() {
  const { settings, currencies, refresh } = useData();
  const toast = useToast();
  const [company, setCompany] = useState(settings?.company || {});
  const [tax, setTax] = useState(settings?.tax || { name: '', rate: 0 });
  const [fiscal, setFiscal] = useState(settings?.fiscalYearStart || '2026-01-01');
  const [lowStock, setLowStock] = useState(settings?.lowStockThreshold || 800);
  const [currencyModal, setCurrencyModal] = useState<{ code: string; rate: number } | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  async function saveCompany() {
    await api.post('/settings', { company, tax, fiscalYearStart: fiscal, lowStockThreshold: lowStock });
    await refresh();
    toast('Settings saved');
  }

  async function updateRate(code: string, rate: number) {
    const cur = currencies.find((c) => c.code === code);
    if (!cur?.id) return;
    await api.put(`/currencies/${cur.id}`, { rate });
    await refresh();
    toast(`Updated ${code} rate`);
    setCurrencyModal(null);
  }

  async function reset() {
    await api.post('/reset', {});
    await refresh();
    toast('Demo data has been regenerated');
    setResetConfirm(false);
  }

  const set = (k: string, v: unknown) => setCompany((c: any) => ({ ...c, [k]: v }));

  return (
    <div>
      <PageHead
        title="Settings"
        sub="Company profile, currencies and data management"
        actions={<button className="btn btn-primary" onClick={saveCompany}><Icon name="check" size={15} /> Save Changes</button>}
      />

      <div className="grid" style={{ gridTemplateColumns: '3fr 2fr' }}>
        <div className="card card-pad">
          <div className="card-title mb-16">Company Profile</div>
          <div className="form-grid">
            <Field label="Company Name"><input className="input" value={company.name || ''} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Short Name"><input className="input" value={company.shortName || ''} onChange={(e) => set('shortName', e.target.value)} /></Field>
            <Field label="Tagline"><input className="input" value={company.tagline || ''} onChange={(e) => set('tagline', e.target.value)} /></Field>
            <Field label="Email"><input className="input" value={company.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Phone"><input className="input" value={company.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Website"><input className="input" value={company.website || ''} onChange={(e) => set('website', e.target.value)} /></Field>
            <Field label="Address"><input className="input" value={company.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
            <Field label="City"><input className="input" value={company.city || ''} onChange={(e) => set('city', e.target.value)} /></Field>
            <Field label="Country"><input className="input" value={company.country || ''} onChange={(e) => set('country', e.target.value)} /></Field>
            <Field label="Tax ID"><input className="input" value={company.taxId || ''} onChange={(e) => set('taxId', e.target.value)} /></Field>
          </div>
          <div className="card-title mt-24 mb-16">Tax & Fiscal Settings</div>
          <div className="form-grid">
            <Field label="Tax Name"><input className="input" value={tax.name || ''} onChange={(e) => setTax({ ...tax, name: e.target.value })} /></Field>
            <Field label="Tax Rate (%)"><input type="number" className="input" value={tax.rate || 0} onChange={(e) => setTax({ ...tax, rate: +e.target.value })} /></Field>
            <Field label="Fiscal Year Start"><input type="date" className="input" value={fiscal} onChange={(e) => setFiscal(e.target.value)} /></Field>
            <Field label="Low Stock Alert Threshold"><input type="number" className="input" value={lowStock} onChange={(e) => setLowStock(+e.target.value)} /></Field>
          </div>
        </div>

        <div className="flex" style={{ flexDirection: 'column', gap: 16, alignItems: 'stretch' }}>
          <div className="card card-pad">
            <div className="flex-between mb-16">
              <div className="card-title">Currencies</div>
              <span className="badge badge-teal">Base: USD</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {currencies.map((c) => (
                <div key={c.code} className="flex-between" style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                  <span className="flex" style={{ gap: 10 }}>
                    <span className="badge badge-gray">{c.code}</span>
                    <span className="small">{c.name}</span>
                  </span>
                  {c.base ? (
                    <span className="small muted">1.0000</span>
                  ) : (
                    <button className="btn btn-ghost btn-xs" onClick={() => setCurrencyModal({ code: c.code, rate: c.rate })}>
                      <span className="money small">1 USD = {c.rate}</span> <Icon name="edit" size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-title mb-16">Data & Backup</div>
            <div className="flex" style={{ flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => {
                fetch('/api/bootstrap').then((r) => r.json()).then((d) => {
                  const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `apex-export-${today()}.json`;
                  a.click();
                });
                toast('Data exported');
              }}><Icon name="download" size={15} /> Export all data (JSON)</button>
              <button className="btn btn-danger" onClick={() => setResetConfirm(true)}><Icon name="refresh" size={15} /> Reset to demo data</button>
            </div>
            <div className="alert alert-info small mt-16">
              Data is stored in a local JSON database on the server. Export regularly for backup.
            </div>
          </div>
        </div>
      </div>

      {currencyModal && (
        <Modal
          size="sm"
          title={`Update ${currencyModal.code} rate`}
          onClose={() => setCurrencyModal(null)}
          foot={<>
            <button className="btn btn-secondary" onClick={() => setCurrencyModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => updateRate(currencyModal.code, currencyModal.rate)}>Save</button>
          </>}
        >
          <Field label="Units per 1 USD">
            <input type="number" className="input" step="0.0001" value={currencyModal.rate} onChange={(e) => setCurrencyModal({ ...currencyModal, rate: +e.target.value })} />
          </Field>
        </Modal>
      )}

      {resetConfirm && (
        <Modal
          size="sm"
          title="Reset demo data?"
          onClose={() => setResetConfirm(false)}
          foot={<>
            <button className="btn btn-secondary" onClick={() => setResetConfirm(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={reset}><Icon name="refresh" size={14} /> Yes, regenerate</button>
          </>}
        >
          <p className="small">This will wipe all current data and regenerate the full Apex Gloves demo dataset (8 months of trading). This cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}
