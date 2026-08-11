import { useRef, useState } from 'react';
import { useData, today } from '../state';
import { useToast } from '../toast';
import { api } from '../api';
import { PageHead, Icon, Field, Modal, Loader, Empty } from '../components/ui';
import type { AdminUser, Currency } from '../types';
import { MODULE_DEFS } from '../types';

const TABS = [
  { key: 'profile', label: 'Company Profile', icon: 'customers' },
  { key: 'preferences', label: 'Preferences', icon: 'settings' },
  { key: 'currencies', label: 'Currencies', icon: 'globe' },
  { key: 'banks', label: 'Bank Accounts', icon: 'bank' },
  { key: 'users', label: 'Users & Roles', icon: 'customers' },
  { key: 'modules', label: 'Modules', icon: 'accounting' },
  { key: 'data', label: 'Data & Backup', icon: 'download' }
];

export default function Settings() {
  const [tab, setTab] = useState('profile');

  return (
    <div>
      <PageHead title="Admin & Settings" sub="Control everything about your workspace from one panel" />
      <div className="toolbar">
        <div className="tabs" style={{ flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t.key} className={`tab ${t.key === tab ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              <Icon name={t.icon} size={14} /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'profile' && <ProfileTab />}
      {tab === 'preferences' && <PreferencesTab />}
      {tab === 'currencies' && <CurrenciesTab />}
      {tab === 'banks' && <BankAccountsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'modules' && <ModulesTab />}
      {tab === 'data' && <DataTab />}
    </div>
  );
}

function TabCard({ title, sub, action, children }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="flex-between mb-16">
        <div>
          <div className="card-title">{title}</div>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SaveButton({ onSave, saving, dirty, label = 'Save Changes' }: { onSave: () => void; saving?: boolean; dirty?: boolean; label?: string }) {
  return (
    <button className="btn btn-primary" onClick={onSave} disabled={saving || !dirty}>
      {saving ? <Loader size={14} light /> : <Icon name="check" size={15} />} {saving ? 'Saving…' : label}
    </button>
  );
}

// ---------------- Company profile ----------------
function ProfileTab() {
  const { settings, refresh } = useData();
  const toast = useToast();
  const [company, setCompany] = useState<Record<string, string>>(settings?.company || {});
  const [tax, setTax] = useState(settings?.tax || { name: '', rate: 0 });
  const [fiscal, setFiscal] = useState(settings?.fiscalYearStart || today());
  const [lowStock, setLowStock] = useState(settings?.lowStockThreshold ?? 800);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setCompany((c) => ({ ...c, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await api.post('/settings', { company, tax, fiscalYearStart: fiscal, lowStockThreshold: lowStock });
      await refresh();
      toast('Company profile saved');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
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
        <div className="flex mt-24"><SaveButton onSave={save} saving={saving} /></div>
      </div>
      <div className="card card-pad">
        <div className="card-title mb-16">Tax & Fiscal Settings</div>
        <div className="form-grid">
          <Field label="Tax Name"><input className="input" value={tax.name || ''} onChange={(e) => setTax({ ...tax, name: e.target.value })} /></Field>
          <Field label="Tax Rate (%)"><input type="number" className="input" step="0.01" value={tax.rate || 0} onChange={(e) => setTax({ ...tax, rate: +e.target.value })} /></Field>
          <Field label="Fiscal Year Start"><input type="date" className="input" value={fiscal} onChange={(e) => setFiscal(e.target.value)} /></Field>
          <Field label="Low Stock Alert Threshold"><input type="number" className="input" value={lowStock} onChange={(e) => setLowStock(+e.target.value)} /></Field>
        </div>
        <div className="alert alert-info small mt-16">
          The tax rate is applied automatically when new invoices are created — no re-entry needed.
        </div>
      </div>
    </div>
  );
}

// ---------------- Preferences ----------------
function PreferencesTab() {
  const { settings, bankAccounts, currencies, refresh } = useData();
  const toast = useToast();
  const [prefs, setPrefs] = useState<Record<string, unknown>>(settings?.preferences || { invoiceDueDays: 30, billDueDays: 45, quotationValidDays: 30, receiptBankAccountId: 'ba1', paymentBankAccountId: 'ba1', defaultCurrency: 'USD' });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: unknown) => setPrefs((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await api.post('/settings', { preferences: prefs });
      await refresh();
      toast('Preferences saved');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <TabCard title="Workflow Defaults" sub="Applied automatically to every new document">
        <div className="form-grid">
          <Field label="Invoice Due Days"><input type="number" className="input" min="0" value={Number(prefs.invoiceDueDays) || 0} onChange={(e) => set('invoiceDueDays', +e.target.value)} /></Field>
          <Field label="Supplier Bill Due Days"><input type="number" className="input" min="0" value={Number(prefs.billDueDays) || 0} onChange={(e) => set('billDueDays', +e.target.value)} /></Field>
          <Field label="Quotation Validity (Days)"><input type="number" className="input" min="0" value={Number(prefs.quotationValidDays) || 0} onChange={(e) => set('quotationValidDays', +e.target.value)} /></Field>
          <Field label="Default Currency">
            <select className="select" value={String(prefs.defaultCurrency || 'USD')} onChange={(e) => set('defaultCurrency', e.target.value)}>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </Field>
          <Field label="Receipts Bank Account">
            <select className="select" value={String(prefs.receiptBankAccountId || '')} onChange={(e) => set('receiptBankAccountId', e.target.value)}>
              {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Payments Bank Account">
            <select className="select" value={String(prefs.paymentBankAccountId || '')} onChange={(e) => set('paymentBankAccountId', e.target.value)}>
              {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex mt-24"><SaveButton onSave={save} saving={saving} /></div>
      </TabCard>
      <div className="card card-pad">
        <div className="card-title mb-16">How automation works</div>
        <ul className="admin-list">
          <li>Due dates default from your terms on every invoice and bill.</li>
          <li>Quotations convert into orders and invoices with one click.</li>
          <li>Purchase orders become bills when you receive the goods.</li>
          <li>Receipts and payments post to the bank account you choose here.</li>
          <li>Stock adjusts automatically when invoices and bills post.</li>
        </ul>
      </div>
    </div>
  );
}

// ---------------- Currencies ----------------
function CurrenciesTab() {
  const { currencies, settings, refresh } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState<Currency | null>(null);
  const [base, setBase] = useState(settings?.baseCurrency || currencies.find((c) => c.base)?.code || 'USD');
  const [saving, setSaving] = useState(false);

  async function updateRate(code: string, rate: number) {
    const cur = currencies.find((c) => c.code === code);
    if (!cur?.id) return;
    try {
      await api.put(`/currencies/${cur.id}`, { rate });
      await refresh();
      toast(`Updated ${code} rate`);
      setEditing(null);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function changeBase() {
    if (!base || base === settings?.baseCurrency) return;
    setSaving(true);
    try {
      await api.post('/settings/base-currency', { code: base });
      await refresh();
      toast(`Reporting currency changed to ${base}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const baseCur = currencies.find((c) => c.code === (settings?.baseCurrency || 'USD'));
  const baseSymbol = baseCur?.symbol || '$';

  return (
    <div>
      <div className="card card-pad mb-16">
        <div className="flex-between" style={{ gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div className="card-title">Base / Reporting Currency</div>
            <div className="card-sub">Choose the currency the whole app reports in. Every amount converts automatically — you never re-enter data.</div>
          </div>
          <div className="flex" style={{ gap: 10 }}>
            <select className="select" value={base} onChange={(e) => setBase(e.target.value)}>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
            <button className="btn btn-primary" onClick={changeBase} disabled={saving || base === settings?.baseCurrency}>
              {saving ? <Loader size={14} light /> : <Icon name="check" size={15} />} Apply
            </button>
          </div>
        </div>
        <div className="alert alert-info small mt-16">
          Currently reporting in <span className="strong">{baseSymbol} {settings?.baseCurrency || 'USD'}</span>. The ledger is always stored in USD internally; rates below convert every screen to your chosen reporting currency.
        </div>
      </div>

      <TabCard
        title="Exchange Rates"
        sub="Foreign currency units per 1 USD (the internal ledger base)"
        action={<span className="badge badge-teal">Base: {baseCur?.code || 'USD'}</span>}
      >
        <div className="table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Symbol</th><th className="num">1 USD =</th><th></th></tr></thead>
            <tbody>
              {currencies.map((c) => (
                <tr key={c.code}>
                  <td><span className="badge badge-gray">{c.code}</span>{c.base && <span className="badge badge-teal" style={{ marginLeft: 6 }}>Base</span>}</td>
                  <td className="strong small">{c.name}</td>
                  <td className="muted">{c.symbol}</td>
                  <td className="num money">{c.base ? '1.0000' : c.rate}</td>
                  <td style={{ width: 60 }}>
                    {!c.base && <button className="btn btn-ghost btn-xs" onClick={() => setEditing(c)}><Icon name="edit" size={14} /> Edit</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editing && (
          <RateModal currency={editing} onClose={() => setEditing(null)} onSave={(rate) => updateRate(editing.code, rate)} />
        )}
      </TabCard>
    </div>
  );
}

function RateModal({ currency, onClose, onSave }: { currency: Currency; onClose: () => void; onSave: (r: number) => void }) {
  const [rate, setRate] = useState(currency.rate);
  return (
    <Modal size="sm" title={`Update ${currency.code} rate`} onClose={onClose}
      foot={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave(rate)}>Save</button>
      </>}>
      <Field label="Units per 1 USD"><input type="number" className="input" step="0.0001" value={rate} onChange={(e) => setRate(+e.target.value)} /></Field>
    </Modal>
  );
}

// ---------------- Bank accounts ----------------
interface BankRec { id: string; name: string; bank: string; number: string; currency: string; opening: number; code?: string; accountId?: string }
function BankAccountsTab() {
  const { bankAccounts, refresh } = useData();
  const toast = useToast();
  const [modal, setModal] = useState<{ open: boolean; bank: BankRec | null }>({ open: false, bank: null });
  const [busy, setBusy] = useState('');

  async function saveBank(b: Partial<BankRec>) {
    setBusy('save');
    try {
      if (modal.bank) await api.put(`/bankAccounts/${modal.bank.id}`, b);
      else await api.post('/bankAccounts', b);
      toast(modal.bank ? 'Bank account updated' : 'Bank account created');
      await refresh();
      setModal({ open: false, bank: null });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function removeBank(b: BankRec) {
    if (!window.confirm(`Remove bank account "${b.name}"? This does not delete posted transactions.`)) return;
    setBusy(b.id);
    try {
      await api.del(`/bankAccounts/${b.id}`);
      toast('Bank account removed');
      await refresh();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <TabCard
      title="Bank Accounts"
      sub="Cash accounts used for receipts, payments and bank transactions"
      action={<button className="btn btn-primary btn-sm" onClick={() => setModal({ open: true, bank: null })}><Icon name="plus" size={14} /> New Bank Account</button>}
    >
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Bank</th><th>Number</th><th>Currency</th><th className="num">Opening</th><th></th></tr></thead>
          <tbody>
            {bankAccounts.map((b) => (
              <tr key={b.id}>
                <td className="strong small">{b.name}</td>
                <td className="muted">{b.bank}</td>
                <td className="muted">{b.number}</td>
                <td>{b.currency}</td>
                <td className="num money">{b.opening.toLocaleString('en-US')}</td>
                <td style={{ width: 90 }}>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-xs" onClick={() => setModal({ open: true, bank: b })}><Icon name="edit" size={14} /></button>
                    <button className="btn btn-ghost btn-xs" disabled={busy === b.id} onClick={() => removeBank(b)}><Icon name="trash" size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!bankAccounts.length && <Empty icon="bank" title="No bank accounts" />}
      {modal.open && (
        <BankModal bank={modal.bank} onClose={() => setModal({ open: false, bank: null })} onSave={saveBank} busy={busy === 'save'} />
      )}
    </TabCard>
  );
}

function BankModal({ bank, onClose, onSave, busy }: { bank: BankRec | null; onClose: () => void; onSave: (b: Partial<BankRec>) => void; busy: boolean }) {
  const { currencies } = useData();
  const [f, setF] = useState<Partial<BankRec>>(bank || { name: '', bank: '', number: '', currency: 'USD', opening: 0, code: '' });
  const set = (k: keyof BankRec, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal title={bank ? `Edit ${bank.name}` : 'New Bank Account'} onClose={onClose}
      foot={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => onSave(f)}>{busy ? 'Saving…' : 'Save'}</button>
      </>}>
      <div className="form-grid">
        <Field label="Account Name"><input className="input" value={f.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Business Checking" /></Field>
        <Field label="Bank Name"><input className="input" value={f.bank || ''} onChange={(e) => set('bank', e.target.value)} /></Field>
        <Field label="Account Number"><input className="input" value={f.number || ''} onChange={(e) => set('number', e.target.value)} placeholder="**** 1234" /></Field>
        <Field label="Currency">
          <select className="select" value={f.currency || 'USD'} onChange={(e) => set('currency', e.target.value)}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </Field>
        {!bank && (
          <>
            <Field label="Opening Balance (local)"><input type="number" className="input" value={f.opening || 0} onChange={(e) => set('opening', +e.target.value)} /></Field>
            <Field label="GL Code (optional)"><input className="input" value={f.code || ''} onChange={(e) => set('code', e.target.value)} placeholder="auto-assigned" /></Field>
          </>
        )}
      </div>
      <div className="alert alert-info small mt-16">A matching asset account and opening balance are created automatically in the chart of accounts.</div>
    </Modal>
  );
}

// ---------------- Users & roles ----------------
const ROLES = ['admin', 'accountant', 'viewer'];
const ROLE_LABEL: Record<string, string> = { admin: 'Administrator', accountant: 'Accountant', viewer: 'Viewer' };
function UsersTab() {
  const { settings, refresh } = useData();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>(settings?.users || []);
  const [modal, setModal] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [saving, setSaving] = useState(false);

  async function saveUsers(list: AdminUser[], msg: string) {
    setSaving(true);
    try {
      await api.post('/settings', { users: list });
      await refresh();
      toast(msg);
      setModal({ open: false, user: null });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function toggle(user: AdminUser) {
    saveUsers(users.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u)), user.active ? 'User deactivated' : 'User activated');
  }

  function saveUser(u: Partial<AdminUser>) {
    if (modal.user) saveUsers(users.map((x) => (x.id === modal.user!.id ? { ...x, ...u, id: x.id } : x)), 'User updated');
    else saveUsers([...users, { id: 'u' + Date.now().toString(36), ...u } as AdminUser], 'User created');
  }

  function removeUser(user: AdminUser) {
    if (!window.confirm(`Remove user "${user.name}"?`)) return;
    saveUsers(users.filter((u) => u.id !== user.id), 'User removed');
  }

  return (
    <TabCard
      title="Users & Roles"
      sub="Team members who can access this workspace"
      action={<button className="btn btn-primary btn-sm" onClick={() => setModal({ open: true, user: null })}><Icon name="plus" size={14} /> New User</button>}
    >
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="strong small">{u.name}</td>
                <td className="muted">{u.email}</td>
                <td className="muted">{u.phone || '—'}</td>
                <td><span className="badge badge-gray">{ROLE_LABEL[u.role] || u.role}</span></td>
                <td>{u.active ? <span className="badge badge-green"><span className="badge-dot" />Active</span> : <span className="badge badge-gray">Inactive</span>}</td>
                <td style={{ width: 110 }}>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-xs" onClick={() => setModal({ open: true, user: u })}><Icon name="edit" size={14} /></button>
                    <button className="btn btn-ghost btn-xs" onClick={() => toggle(u)}><Icon name="refresh" size={14} /></button>
                    <button className="btn btn-ghost btn-xs" onClick={() => removeUser(u)}><Icon name="trash" size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!users.length && <Empty icon="customers" title="No users yet" />}
      {saving && <div className="small muted mt-16">Saving…</div>}
      {modal.open && (
        <UserModal user={modal.user} onClose={() => setModal({ open: false, user: null })} onSave={saveUser} />
      )}
    </TabCard>
  );
}

function UserModal({ user, onClose, onSave }: { user: AdminUser | null; onClose: () => void; onSave: (u: Partial<AdminUser>) => void }) {
  const [f, setF] = useState<Partial<AdminUser>>(user || { name: '', email: '', phone: '', role: 'viewer', active: true });
  const set = (k: keyof AdminUser, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal title={user ? `Edit ${user.name}` : 'New User'} onClose={onClose}
      foot={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave(f)}>Save</button>
      </>}>
      <div className="form-grid">
        <Field label="Full Name"><input className="input" value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Email"><input className="input" value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Phone"><input className="input" value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Role">
          <select className="select" value={f.role || 'viewer'} onChange={(e) => set('role', e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex mt-16">
        <label className="flex small" style={{ gap: 8 }}>
          <input type="checkbox" checked={!!f.active} onChange={(e) => set('active', e.target.checked)} /> Active user
        </label>
      </div>
    </Modal>
  );
}

// ---------------- Modules ----------------
function ModulesTab() {
  const { settings, refresh } = useData();
  const toast = useToast();
  const [mods, setMods] = useState<Record<string, boolean>>(settings?.modules || { sales: true, purchases: true, inventory: true, banking: true, accounting: true, reports: true });
  const [saving, setSaving] = useState(false);

  function toggle(key: string) {
    const next = { ...mods, [key]: !(mods[key] ?? true) };
    setMods(next);
    setSaving(true);
    api.post('/settings', { modules: next })
      .then(() => refresh())
      .then(() => toast(`Module ${next[key] ? 'enabled' : 'disabled'}`))
      .catch((e) => toast((e as Error).message, 'error'))
      .finally(() => setSaving(false));
  }

  return (
    <div>
      <div className="grid grid-2">
        {MODULE_DEFS.map((m) => {
          const on = mods[m.key] !== false;
          return (
            <div className={`card card-pad module-card ${on ? '' : 'module-off'}`} key={m.key}>
              <div className="flex-between">
                <div className="flex">
                  <div className="module-icon"><Icon name={m.icon} size={18} /></div>
                  <div>
                    <div className="card-title">{m.label}</div>
                    <div className="card-sub">{m.desc}</div>
                  </div>
                </div>
                <button className={`switch ${on ? 'on' : ''}`} onClick={() => toggle(m.key)} role="switch" aria-checked={on}>
                  <span className="switch-knob" />
                </button>
              </div>
              <div className="tiny muted mt-16">{on ? 'Visible in the sidebar and fully functional' : 'Hidden from the sidebar and disabled'}</div>
            </div>
          );
        })}
      </div>
      <div className="card card-pad mt-16">
        <div className="alert alert-info small">Module toggles control which parts of the application are available to your team. Disabled modules are hidden from the navigation immediately after saving.</div>
      </div>
    </div>
  );
}

// ---------------- Data & backup ----------------
function DataTab() {
  const { refresh } = useData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);

  async function exportData() {
    try {
      const d = await api.get('/export');
      const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `apex-backup-${today()}.json`;
      a.click();
      toast('Full backup exported');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function restoreFile(file: File) {
    setBusy('restore');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await api.post('/restore', json);
      await refresh();
      toast('Backup restored successfully');
    } catch (e) {
      toast('Restore failed: ' + (e as Error).message, 'error');
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function reset() {
    setBusy('reset');
    try {
      await api.post('/reset', {});
      await refresh();
      toast('Demo data regenerated');
      setResetConfirm(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <TabCard title="Backup & Restore" sub="The full database — every transaction and ledger entry">
        <div className="flex" style={{ flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
          <button className="btn btn-primary" disabled={busy !== ''} onClick={exportData}><Icon name="download" size={15} /> {busy === 'export' ? 'Exporting…' : 'Download full backup (JSON)'}</button>
          <button className="btn btn-secondary" disabled={busy !== ''} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={15} /> {busy === 'restore' ? 'Restoring…' : 'Restore from backup (JSON)'}
          </button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) restoreFile(f); }} />
        </div>
        <div className="alert alert-info small mt-16">Restoring replaces all current data with the contents of the backup file.</div>
      </TabCard>
      <TabCard title="Danger Zone" sub="Regenerate or erase the demo dataset">
        <button className="btn btn-danger" disabled={busy !== ''} onClick={() => setResetConfirm(true)}><Icon name="refresh" size={15} /> Reset to demo data</button>
        <div className="alert alert-warn small mt-16">Reset wipes all current data and regenerates the full Apex Gloves demo dataset (8 months of trading). This cannot be undone.</div>
      </TabCard>

      {resetConfirm && (
        <Modal size="sm" title="Reset demo data?" onClose={() => setResetConfirm(false)}
          foot={<>
            <button className="btn btn-secondary" onClick={() => setResetConfirm(false)}>Cancel</button>
            <button className="btn btn-danger" disabled={busy === 'reset'} onClick={reset}><Icon name="refresh" size={14} /> Yes, regenerate</button>
          </>}>
          <p className="small">All current data will be replaced with the demo dataset.</p>
        </Modal>
      )}
    </div>
  );
}
