import { useMemo, useState } from 'react';
import { useData, fmt, today } from '../state';
import { useToast } from '../toast';
import { api } from '../api';
import { PageHead, Icon, Modal, Field, Empty, CountUp } from '../components/ui';

export default function Banking() {
  const { bankAccounts, journal, accounts, currencies, refresh, refreshDashboard } = useData();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);

  const balances = useMemo(() => {
    return bankAccounts.map((ba) => {
      const rate = currencies.find((c) => c.code === ba.currency)?.rate || 1;
      let bal = ba.opening / rate;
      for (const je of journal) for (const l of je.lines) if (l.accountId === ba.accountId) bal += (l.debit || 0) - (l.credit || 0);
      return { ...ba, balance: bal };
    });
  }, [bankAccounts, journal, currencies]);

  const txs = useMemo(() => {
    const openingByAcct: Record<string, number> = {};
    for (const ba of bankAccounts) openingByAcct[ba.accountId] = ba.opening;
    const rows = journal
      .filter((je) => je.lines.some((l) => l.accountId === 'bank_main' || l.accountId === 'bank_export' || l.accountId === 'bank_pkr'))
      .map((je) => {
        const bankLine = je.lines.find((l) => l.accountId === 'bank_main' || l.accountId === 'bank_export' || l.accountId === 'bank_pkr')!;
        const otherLine = je.lines.find((l) => l !== bankLine);
        const amount = (bankLine?.debit || 0) - (bankLine?.credit || 0);
        const account = accounts.find((a) => a.id === otherLine?.accountId);
        return { id: je.id, date: je.date, memo: je.memo, ref: je.ref, amount, acct: bankLine.accountId, opening: openingByAcct[bankLine.accountId] || 0, account: account?.name || je.memo, balance: 0 };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const running: Record<string, number> = {};
    for (const t of rows) {
      running[t.acct] = (running[t.acct] ?? t.opening) + t.amount;
      t.balance = running[t.acct];
    }
    return rows.reverse();
  }, [journal, accounts, bankAccounts]);

  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);

  function exportCSV() {
    const rows = [['Date', 'Memo', 'Reference', 'Account', 'Amount (USD)']];
    for (const t of txs) rows.push([t.date, t.memo, t.ref, t.account, t.amount.toFixed(2)]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `apex-bank-transactions-${today()}.csv`;
    a.click();
    toast('CSV exported');
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), note: 'Apex Gloves - full data backup' }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `apex-backup-${today()}.json`;
    a.click();
    toast('Backup exported');
  }

  return (
    <div>
      <PageHead
        title="Banking"
        sub="Cash position and bank activity across your accounts"
        actions={<>
          <button className="btn btn-secondary" onClick={exportCSV}><Icon name="download" size={15} /> Export CSV</button>
          <button className="btn btn-secondary" onClick={exportBackup}><Icon name="download" size={15} /> Backup</button>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}><Icon name="plus" size={15} /> New Transaction</button>
        </>}
      />

      <div className="grid grid-3 mb-16">
        {balances.map((b) => (
          <div className="card card-pad" key={b.id}>
            <div className="flex-between">
              <div>
                <div className="card-title">{b.name}</div>
                <div className="tiny muted mt-8">{b.bank} · {b.number}</div>
              </div>
              <div className="avatar" style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)' }}><Icon name="bank" size={18} /></div>
            </div>
            <div className="strong" style={{ fontSize: 24, marginTop: 14 }}><CountUp value={b.balance} format={fmt} /></div>
            <div className="tiny muted">Available · {b.currency}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex-between" style={{ padding: '18px 20px 0' }}>
          <div className="card-title">Bank Activity</div>
          <div className="tiny muted">Total cash: <span className="strong"><CountUp value={totalBalance} format={fmt} /></span></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Memo</th><th>Ref</th><th>Account</th><th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id}>
                  <td className="muted">{t.date}</td>
                  <td className="small">{t.memo}</td>
                  <td className="small muted">{t.ref}</td>
                  <td className="small">{t.account}</td>
                  <td className="num money" style={{ color: 'var(--success)' }}>{t.amount > 0 ? fmt(t.amount) : ''}</td>
                  <td className="num money" style={{ color: 'var(--danger)' }}>{t.amount < 0 ? fmt(Math.abs(t.amount)) : ''}</td>
                  <td className="num money muted">{fmt(t.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!txs.length && <Empty icon="bank" title="No transactions" />}
      </div>

      {addOpen && <TxModal accounts={accounts} onClose={() => setAddOpen(false)} onDone={async () => { await refresh(); await refreshDashboard(); }} />}
    </div>
  );
}

function TxModal({ accounts, onClose, onDone }: { accounts: { id: string; name: string; type: string }[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [memo, setMemo] = useState('');
  const [amount, setAmount] = useState(0);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [accountId, setAccountId] = useState(accounts.find((a) => a.type === 'expense')?.id || '');
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!memo || !amount) return;
    setSaving(true);
    try {
      await api.post('/bank-transactions', { date, memo, accountId, amountUsd: type === 'expense' ? -amount : amount });
      toast('Transaction recorded');
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
      title="New Bank Transaction"
      onClose={onClose}
      foot={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Record'}</button>
      </>}
    >
      <div className="form-grid">
        <Field label="Type">
          <select className="select" value={type} onChange={(e) => setType(e.target.value as 'expense' | 'income')}>
            <option value="expense">Expense (money out)</option>
            <option value="income">Income (money in)</option>
          </select>
        </Field>
        <Field label="Amount (USD)"><input type="number" className="input" value={amount} onChange={(e) => setAmount(+e.target.value)} /></Field>
        <Field label="Date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Account">
          <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.filter((a) => a.type === 'expense' || a.type === 'income').map((a) => <option key={a.id} value={a.id}>{(a as any).code} · {a.name}</option>)}
          </select>
        </Field>
        <Field label="Memo" className="grow"><input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="e.g. Office rent" /></Field>
      </div>
    </Modal>
  );
}
