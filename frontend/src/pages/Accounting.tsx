import { Fragment, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData, fmt } from '../state';
import { useToast } from '../toast';
import { api } from '../api';
import { PageHead, Icon, Badge, Empty, Modal, Field } from '../components/ui';

const TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];
const TYPE_LABEL: Record<string, string> = { asset: 'Assets', liability: 'Liabilities', equity: 'Equity', income: 'Income', expense: 'Expenses' };

export default function Accounting() {
  const { view } = useParams();
  const navigate = useNavigate();

  return (
    <div>
      <PageHead title={view === 'journal' ? 'Journal & Ledger' : 'Chart of Accounts'} sub="Double-entry records, GL balances and multi-currency posting" />
      <div className="tabs mb-16">
        <button className={`tab ${view === 'chart' ? 'active' : ''}`} onClick={() => navigate('/accounting/chart')}>Chart of Accounts</button>
        <button className={`tab ${view === 'journal' ? 'active' : ''}`} onClick={() => navigate('/accounting/journal')}>Journal Entries</button>
        <button className={`tab ${view === 'ledger' ? 'active' : ''}`} onClick={() => navigate('/accounting/ledger')}>General Ledger</button>
      </div>

      {view === 'chart' && <ChartView />}
      {view === 'journal' && <JournalView />}
      {view === 'ledger' && <LedgerView />}
    </div>
  );
}

function ChartView() {
  const { accounts, journal, refresh } = useData();
  const [creating, setCreating] = useState(false);
  const balances = useMemo(() => {
    const bal: Record<string, number> = {};
    for (const a of accounts) bal[a.id] = 0;
    for (const je of journal) for (const l of je.lines) bal[l.accountId] = (bal[l.accountId] || 0) + (l.debit || 0) - (l.credit || 0);
    return bal;
  }, [accounts, journal]);

  return (
    <div>
      <div className="flex-between mb-16">
        <span className="small muted">{accounts.length} accounts</span>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Icon name="plus" size={14} /> New Account</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th style={{ width: 70 }}>Code</th><th>Account</th><th>Category</th><th>Type</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {TYPES.map((t) => (
                <Fragment key={t}>
                  <tr className="report-group-row"><td colSpan={5}>{TYPE_LABEL[t]}</td></tr>
                  {accounts.filter((a) => a.type === t).map((a) => {
                    const sign = t === 'asset' ? 1 : -1;
                    return (
                      <tr key={a.id}>
                        <td className="muted">{a.code}</td>
                        <td className="strong small">{a.name}</td>
                        <td className="small muted">{a.category}</td>
                        <td><span className="badge badge-gray">{t}</span></td>
                        <td className="num money">{fmt(balances[a.id] * sign)}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {creating && <AccountModal onClose={() => setCreating(false)} onDone={async () => { await refresh(); setCreating(false); }} />}
    </div>
  );
}

function AccountModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('asset');
  const [category, setCategory] = useState('General');
  const [opening, setOpening] = useState(0);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!code || !name) return;
    setSaving(true);
    try {
      await api.post('/accounts', { code, name, type, category, opening });
      toast('Account created');
      onDone();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      size="sm"
      title="New Account"
      onClose={onClose}
      foot={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Create Account'}</button>
      </>}
    >
      <div className="form-grid">
        <Field label="Code"><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 6100" /></Field>
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vehicle Expenses" /></Field>
        <Field label="Type">
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Category"><input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Operating, Sales, Current Asset..." /></Field>
        {['asset', 'liability', 'equity'].includes(type) && (
          <Field label="Opening Balance (USD)"><input type="number" className="input" value={opening} onChange={(e) => setOpening(+e.target.value)} /></Field>
        )}
      </div>
    </Modal>
  );
}

function JournalView() {
  const { journal, accounts, contacts } = useData();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Memo</th><th>Ref</th><th>Type</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
          <tbody>
            {journal.slice().sort((a, b) => b.date.localeCompare(a.date)).map((je) => {
              const dr = je.lines.reduce((s, l) => s + (l.debit || 0), 0);
              const cr = je.lines.reduce((s, l) => s + (l.credit || 0), 0);
              return (
                <Fragment key={je.id}>
                  <tr className="clickable" onClick={() => setOpenId(openId === je.id ? null : je.id)}>
                    <td className="muted">{je.date}</td>
                    <td className="small">{je.memo}</td>
                    <td className="small muted">{je.ref}</td>
                    <td><span className="badge badge-gray">{je.docType}</span></td>
                    <td className="num money">{dr ? fmt(dr) : ''}</td>
                    <td className="num money">{cr ? fmt(cr) : ''}</td>
                  </tr>
                  {openId === je.id && (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--surface-2)', padding: '8px 14px' }}>
                        <table style={{ width: '100%' }}>
                          <tbody>
                            {je.lines.map((l, i) => {
                              const acct = accounts.find((a) => a.id === l.accountId);
                              return (
                                <tr key={i}>
                                  <td style={{ border: 'none', padding: '4px 0' }} className="small">
                                    {l.debit ? <span className="badge badge-red">Dr</span> : <span className="badge badge-green">Cr</span>}
                                    <span style={{ marginLeft: 8 }}>{acct?.code} · {acct?.name || l.accountId}</span>
                                  </td>
                                  <td style={{ border: 'none', textAlign: 'right' }} className="money small">{l.debit ? fmt(l.debit) : ''}</td>
                                  <td style={{ border: 'none', textAlign: 'right' }} className="money small">{l.credit ? fmt(l.credit) : ''}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {!journal.length && <Empty icon="accounting" title="No journal entries" />}
    </div>
  );
}

function LedgerView() {
  const { accounts, journal } = useData();
  const [accountId, setAccountId] = useState('bank_main');

  const entries = useMemo(() => {
    let running = 0;
    return journal
      .filter((je) => je.lines.some((l) => l.accountId === accountId))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((je) => {
        const line = je.lines.find((l) => l.accountId === accountId)!;
        running += (line.debit || 0) - (line.credit || 0);
        return { ...je, dr: line.debit || 0, cr: line.credit || 0, balance: running };
      });
  }, [journal, accountId]);

  const acct = accounts.find((a) => a.id === accountId);

  return (
    <div className="card card-pad">
      <div className="flex-between mb-16">
        <div>
          <div className="card-title">{acct?.code} · {acct?.name}</div>
          <div className="card-sub">{entries.length} postings · ending balance <span className="strong">{fmt(entries[entries.length - 1]?.balance || 0)}</span></div>
        </div>
        <select className="select" style={{ width: 300 }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Memo</th><th>Ref</th><th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="muted">{e.date}</td>
                <td className="small">{e.memo}</td>
                <td className="small muted">{e.ref}</td>
                <td className="num money">{e.dr ? fmt(e.dr) : ''}</td>
                <td className="num money">{e.cr ? fmt(e.cr) : ''}</td>
                <td className="num money strong">{fmt(e.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!entries.length && <Empty icon="accounting" title="No activity on this account" />}
    </div>
  );
}
