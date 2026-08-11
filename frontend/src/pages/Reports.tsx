import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useData, fmt, fmtQty, today } from '../state';
import { useToast } from '../toast';
import { api } from '../api';
import { PageHead, Icon, Badge, Skeleton, Empty } from '../components/ui';
import { DonutChart } from '../components/Charts';
import { downloadReportPdf } from '../utils/pdf';

const REPORTS = [
  { id: 'profit-loss', label: 'Profit & Loss', icon: 'trend' },
  { id: 'balance-sheet', label: 'Balance Sheet', icon: 'accounting' },
  { id: 'cash-flow', label: 'Cash Flow', icon: 'wallet' },
  { id: 'sales-analysis', label: 'Sales Analysis', icon: 'sales' },
  { id: 'purchase-analysis', label: 'Purchase Analysis', icon: 'purchases' },
  { id: 'inventory', label: 'Inventory Valuation', icon: 'box' },
  { id: 'aging', label: 'Receivables & Payables', icon: 'money' }
];

export default function Reports() {
  const [report, setReport] = useState('profit-loss');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState(today());
  const toast = useToast();
  const { settings, currencies } = useData();
  const base = currencies.find((c) => c.code === (settings?.baseCurrency || 'USD'));

  function exportTable(id: string, rows: (string | number)[][]) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${id}-${today()}.csv`;
    a.click();
    toast('Report exported');
  }

  function exportPdf(id: string, title: string, rows: (string | number)[][]) {
    downloadReportPdf({
      title,
      sub: `${meta?.label} · ${from} → ${to} · Generated ${new Date().toLocaleString()} · Amounts in ${base?.symbol || '$'} (${base?.code || 'USD'})`,
      head: [rows[0].map(String)],
      body: rows.slice(1)
    });
    toast('PDF exported');
  }

  const meta = REPORTS.find((r) => r.id === report);

  return (
    <div>
      <PageHead
        title="Reports"
        sub="Financial statements and business analytics"
        actions={<>
          {['profit-loss', 'cash-flow', 'sales-analysis', 'purchase-analysis'].includes(report) && (
            <>
              <input type="date" className="input input-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="muted small">to</span>
              <input type="date" className="input input-sm" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
        </>}
      />

      <div className="toolbar">
        <div className="tabs" style={{ flexWrap: 'wrap', maxWidth: 800 }}>
          {REPORTS.map((r) => (
            <button key={r.id} className={`tab ${r.id === report ? 'active' : ''}`} onClick={() => setReport(r.id)}>{r.label}</button>
          ))}
        </div>
        <div className="grow" />
        <span className="badge badge-gray">{meta?.label} · {from} → {to}</span>
      </div>

      {report === 'profit-loss' && <ProfitLoss from={from} to={to} onExport={(r) => exportTable('profit-loss', r)} onPdf={(r) => exportPdf('profit-loss', 'Profit & Loss Statement', r)} />}
      {report === 'balance-sheet' && <BalanceSheet onExport={(r) => exportTable('balance-sheet', r)} onPdf={(r) => exportPdf('balance-sheet', 'Balance Sheet', r)} />}
      {report === 'cash-flow' && <CashFlow from={from} to={to} onExport={(r) => exportTable('cash-flow', r)} onPdf={(r) => exportPdf('cash-flow', 'Cash Flow Statement', r)} />}
      {report === 'sales-analysis' && <SalesAnalysis from={from} to={to} onExport={(r) => exportTable('sales-analysis', r)} onPdf={(r) => exportPdf('sales-analysis', 'Sales Analysis', r)} />}
      {report === 'purchase-analysis' && <PurchaseAnalysis from={from} to={to} onExport={(r) => exportTable('purchase-analysis', r)} onPdf={(r) => exportPdf('purchase-analysis', 'Purchase Analysis', r)} />}
      {report === 'inventory' && <InventoryValuation onExport={(r) => exportTable('inventory', r)} onPdf={(r) => exportPdf('inventory', 'Inventory Valuation', r)} />}
      {report === 'aging' && <Aging onExport={(r) => exportTable('aging', r)} onPdf={(r) => exportPdf('aging', 'Receivables & Payables Aging', r)} />}
    </div>
  );
}

function useReport<T>(path: string, key?: string) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    setData(null);
    api.get(path).then(setData).catch((e) => setErr(e.message));
  }, [path, key]);
  return { data, err };
}

function ReportTable({ cols, rows, footer, exportBtn, pdfBtn }: { cols: string[]; rows: ReactNode | ReactNode[]; footer?: ReactNode; exportBtn?: () => void; pdfBtn?: () => void }) {
  return (
    <div className="card">
      <div className="flex-between" style={{ padding: '14px 20px 0' }}>
        <div />
        <div className="flex" style={{ gap: 8 }}>
          {pdfBtn && <button className="btn btn-secondary btn-sm" onClick={pdfBtn}><Icon name="printer" size={14} /> PDF</button>}
          {exportBtn && <button className="btn btn-secondary btn-sm" onClick={exportBtn}><Icon name="download" size={14} /> Export CSV</button>}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>{cols.map((c, i) => <th key={i} className={c === 'Amount' ? 'num' : ''}>{c}</th>)}</tr></thead>
          <tbody>{rows}</tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
    </div>
  );
}

function ProfitLoss({ from, to, onExport, onPdf }: { from: string; to: string; onExport: (rows: (string | number)[][]) => void; onPdf: (rows: (string | number)[][]) => void }) {
  const { data, err } = useReport<{ rows: any[]; income: number; expense: number; netProfit: number }>(`/api/reports/profit-loss?from=${from}&to=${to}`, from + to);
  if (err) return <Empty icon="reports" title="Failed to load" sub={err} />;
  if (!data) return <Skeleton height={300} />;

  const rows: (string | number)[][] = [['Account', 'Code', 'Amount']];
  const pdfData = [...rows, ...data.rows.map((r) => [r.name, r.code, Number(r.amount.toFixed(2))])];
  const exportRows = () => onExport([...rows, ...data.rows.map((r) => [r.name, r.code, r.amount.toFixed(2)])]);
  const pdfRows = () => onPdf([...pdfData,
    ['Total Income', '', Number(data.income.toFixed(2))],
    ['Total Expenses', '', Number(data.expense.toFixed(2))],
    ['Net Profit', '', Number(data.netProfit.toFixed(2))]
  ]);

  const groups: Record<string, any[]> = {};
  for (const r of data.rows) (groups[r.category] = groups[r.category] || []).push(r);

  return (
    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <ReportTable
        cols={['Account', 'Category', 'Amount']}
        exportBtn={exportRows}
        pdfBtn={pdfRows}
        rows={
          <>
            {Object.entries(groups).map(([cat, rs]) => (
              <Fragment key={cat}>
                <tr className="report-group-row"><td colSpan={3}>{cat}</td></tr>
                {rs.map((r) => (
                  <tr key={r.accountId}>
                    <td>{r.name}</td>
                    <td className="small muted">{r.category}</td>
                    <td className={`num money ${r.type === 'expense' ? '' : 'strong'}`}>{fmt(r.amount)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </>
        }
        footer={
          <>
            <tr><td colSpan={2} className="text-right strong">Total Income</td><td className="num strong money">{fmt(data.income)}</td></tr>
            <tr><td colSpan={2} className="text-right strong">Total Expenses</td><td className="num strong money">{fmt(data.expense)}</td></tr>
            <tr className="report-total-row"><td colSpan={2} className="text-right">Net Profit</td><td className={`num ${data.netProfit >= 0 ? 'net-positive' : 'net-negative'}`}>{fmt(data.netProfit)}</td></tr>
          </>
        }
      />
      <div className="card card-pad">
        <div className="card-title mb-16">Margin Snapshot</div>
        {data.income > 0 && (
          <>
            <div className="mb-16"><DonutChart data={[
              { label: 'Cost of Goods', value: Math.abs(data.expense), color: '#d97706' },
              { label: 'Net Profit', value: Math.max(0, data.netProfit), color: '#0d9488' }
            ]} size={150} thickness={22} /></div>
            <div className="grid grid-2">
              <div className="stat teal"><div className="stat-label">Gross Margin</div><div className="stat-value" style={{ fontSize: 20 }}>{((data.income - Math.abs(data.expense)) / data.income * 100).toFixed(1)}%</div></div>
              <div className="stat amber"><div className="stat-label">Net Margin</div><div className="stat-value" style={{ fontSize: 20 }}>{(data.netProfit / data.income * 100).toFixed(1)}%</div></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BalanceSheet({ onExport, onPdf }: { onExport: (rows: (string | number)[][]) => void; onPdf: (rows: (string | number)[][]) => void }) {
  const { data, err } = useReport<{ byType: Record<string, any[]>; assets: number; liabilities: number; equity: number; netProfit: number; balanced: boolean }>('/api/reports/balance-sheet');
  if (err) return <Empty icon="reports" title="Failed to load" sub={err} />;
  if (!data) return <Skeleton height={300} />;

  const section = (type: 'asset' | 'liability' | 'equity', label: string, total: number) => (
    <>
      <tr className="report-group-row"><td colSpan={2}>{label}</td></tr>
      {(data.byType[type] || []).map((r) => (
        <tr key={r.accountId}><td>{r.name}</td><td className="num money">{fmt(r.amount)}</td></tr>
      ))}
      <tr className="report-total-row"><td>Total {label}</td><td className="num">{fmt(total)}</td></tr>
    </>
  );

  const exportRows = () => {
    const rows: (string | number)[][] = [['', 'Amount']];
    for (const t of ['asset', 'liability', 'equity']) {
      rows.push([`TOTAL ${t.toUpperCase()}`, (data as any)[t === 'asset' ? 'assets' : t === 'liability' ? 'liabilities' : 'equity']]);
      for (const r of data.byType[t]) rows.push([r.name, r.amount]);
    }
    onExport(rows);
  };

  const pdfRows = () => {
    const rows: (string | number)[][] = [['', 'Amount']];
    for (const t of ['asset', 'liability', 'equity']) {
      rows.push([`TOTAL ${t.toUpperCase()}`, Number((data as any)[t === 'asset' ? 'assets' : t === 'liability' ? 'liabilities' : 'equity'].toFixed(2))]);
      for (const r of data.byType[t]) rows.push([r.name, Number(r.amount.toFixed(2))]);
    }
    rows.push(['Net Profit', Number(data.netProfit.toFixed(2))]);
    rows.push(['TOTAL LIABILITIES + EQUITY', Number((data.liabilities + data.equity + data.netProfit).toFixed(2))]);
    onPdf(rows);
  };

  return (
    <div>
      <div className="grid grid-4 mb-16">
        <div className="stat teal"><div className="stat-label">Total Assets</div><div className="stat-value" style={{ fontSize: 20 }}>{fmt(data.assets)}</div></div>
        <div className="stat amber"><div className="stat-label">Total Liabilities</div><div className="stat-value" style={{ fontSize: 20 }}>{fmt(data.liabilities)}</div></div>
        <div className="stat green"><div className="stat-label">Equity + Profit</div><div className="stat-value" style={{ fontSize: 20 }}>{fmt(data.equity + data.netProfit)}</div></div>
        <div className={`stat ${data.balanced ? 'green' : 'red'}`}><div className="stat-label">Books Balanced</div><div className="stat-value" style={{ fontSize: 20 }}>{data.balanced ? 'Yes' : 'No'}</div></div>
      </div>
      <ReportTable
        cols={['Account', 'Amount']}
        exportBtn={exportRows}
        pdfBtn={pdfRows}
        rows={<>
          {section('asset', 'Assets', data.assets)}
          {section('liability', 'Liabilities', data.liabilities)}
          <tr className="report-group-row"><td colSpan={2}>Equity</td></tr>
          {(data.byType.equity || []).map((r) => <tr key={r.accountId}><td>{r.name}</td><td className="num money">{fmt(r.amount)}</td></tr>)}
          <tr><td>Net Profit (Current Period)</td><td className="num money net-positive">{fmt(data.netProfit)}</td></tr>
          <tr className="report-total-row"><td>Total Equity</td><td className="num">{fmt(data.equity + data.netProfit)}</td></tr>
          <tr className="report-total-row"><td>Liabilities + Equity</td><td className="num">{fmt(data.liabilities + data.equity + data.netProfit)}</td></tr>
        </>}
      />
    </div>
  );
}

function CashFlow({ from, to, onExport, onPdf }: { from: string; to: string; onExport: (rows: (string | number)[][]) => void; onPdf: (rows: (string | number)[][]) => void }) {
  const { data, err } = useReport<{ inflow: number; outflow: number; net: number; categories: Record<string, number> }>(`/api/reports/cash-flow?from=${from}&to=${to}`, from + to);
  if (err) return <Empty icon="reports" title="Failed to load" sub={err} />;
  if (!data) return <Skeleton height={300} />;

  const exportRows = () => onExport([
    ['Metric', 'Amount'],
    ['Cash Inflow', data.inflow], ['Cash Outflow', data.outflow], ['Net Cash Flow', data.net],
    ['Operating', data.categories.operating], ['Financing', data.categories.financing]
  ]);

  const pdfRows = () => onPdf([
    ['Metric', 'Amount'],
    ['Cash Inflow', Number(data.inflow.toFixed(2))], ['Cash Outflow', Number(data.outflow.toFixed(2))], ['Net Cash Flow', Number(data.net.toFixed(2))],
    ['Operating Activities', Number(data.categories.operating.toFixed(2))], ['Financing Activities', Number(data.categories.financing.toFixed(2))]
  ]);

  return (
    <div>
      <div className="grid grid-3 mb-16">
        <div className="stat green"><div className="stat-label">Cash Inflow</div><div className="stat-value" style={{ fontSize: 20 }}>{fmt(data.inflow)}</div></div>
        <div className="stat red"><div className="stat-label">Cash Outflow</div><div className="stat-value" style={{ fontSize: 20 }}>{fmt(data.outflow)}</div></div>
        <div className={`stat ${data.net >= 0 ? 'teal' : 'red'}`}><div className="stat-label">Net Cash Flow</div><div className="stat-value" style={{ fontSize: 20 }}>{fmt(data.net)}</div></div>
      </div>
      <ReportTable
        cols={['Category', 'Amount']}
        exportBtn={exportRows}
        pdfBtn={pdfRows}
        rows={<>
          <tr><td>Operating Activities</td><td className="num money">{fmt(data.categories.operating)}</td></tr>
          <tr><td>Financing Activities</td><td className="num money">{fmt(data.categories.financing)}</td></tr>
        </>}
        footer={<tr className="report-total-row"><td>Net Change in Cash</td><td className="num">{fmt(data.net)}</td></tr>}
      />
    </div>
  );
}

function SalesAnalysis({ from, to, onExport, onPdf }: { from: string; to: string; onExport: (rows: (string | number)[][]) => void; onPdf: (rows: (string | number)[][]) => void }) {
  const { sales } = useData();
  const [groupBy, setGroupBy] = useState('customer');
  const { data, err } = useReport<{ rows: { name: string; count: number; revenue: number; units: number }[]; total: number }>(`/api/reports/sales-analysis?from=${from}&to=${to}&groupBy=${groupBy}`, from + to + groupBy);
  if (err) return <Empty icon="reports" title="Failed to load" sub={err} />;
  if (!data) return <Skeleton height={300} />;

  const exportRows = () => onExport([
    [groupBy === 'customer' ? 'Customer' : 'Product', 'Invoices', 'Units', 'Revenue'],
    ...data.rows.map((r) => [r.name, r.count, r.units, r.revenue.toFixed(2)])
  ]);

  const pdfRows = () => onPdf([
    [groupBy === 'customer' ? 'Customer' : 'Product', 'Invoices', 'Units', 'Revenue'],
    ...data.rows.map((r) => [r.name, r.count, r.units, Number(r.revenue.toFixed(2))]),
    ['TOTAL REVENUE', '', '', Number(data.total.toFixed(2))]
  ]);

  return (
    <div>
      <div className="flex-between mb-16">
        <div className="seg">
          <button className={groupBy === 'customer' ? 'active' : ''} onClick={() => setGroupBy('customer')}>By Customer</button>
          <button className={groupBy === 'product' ? 'active' : ''} onClick={() => setGroupBy('product')}>By Product</button>
        </div>
        <span className="small muted">Top {groupBy === 'customer' ? 'customers' : 'products'} by revenue</span>
      </div>
      <ReportTable
        cols={[groupBy === 'customer' ? 'Customer' : 'Product', 'Invoices', 'Units', 'Revenue']}
        exportBtn={exportRows}
        pdfBtn={pdfRows}
        rows={data.rows.map((r, i) => (
          <tr key={r.name}>
            <td><span className="badge badge-gray" style={{ marginRight: 8 }}>#{i + 1}</span>{r.name}</td>
            <td>{r.count}</td>
            <td className="num">{fmtQty(r.units)}</td>
            <td className="num money strong">{fmt(r.revenue)}</td>
          </tr>
        ))}
        footer={<tr className="report-total-row"><td colSpan={3} className="text-right">Total Revenue</td><td className="num">{fmt(data.total)}</td></tr>}
      />
    </div>
  );
}

function PurchaseAnalysis({ from, to, onExport, onPdf }: { from: string; to: string; onExport: (rows: (string | number)[][]) => void; onPdf: (rows: (string | number)[][]) => void }) {
  const { data, err } = useReport<{ rows: { name: string; count: number; total: number }[]; total: number }>(`/api/reports/purchase-analysis?from=${from}&to=${to}`, from + to);
  if (err) return <Empty icon="reports" title="Failed to load" sub={err} />;
  if (!data) return <Skeleton height={300} />;

  const exportRows = () => onExport([
    ['Supplier', 'Bills', 'Total'],
    ...data.rows.map((r) => [r.name, r.count, r.total.toFixed(2)])
  ]);

  const pdfRows = () => onPdf([
    ['Supplier', 'Bills', 'Total'],
    ...data.rows.map((r) => [r.name, r.count, Number(r.total.toFixed(2))]),
    ['TOTAL PURCHASES', '', Number(data.total.toFixed(2))]
  ]);

  return (
    <ReportTable
      cols={['Supplier', 'Bills', 'Total']}
      exportBtn={exportRows}
      pdfBtn={pdfRows}
      rows={data.rows.map((r, i) => (
        <tr key={r.name}>
          <td><span className="badge badge-gray" style={{ marginRight: 8 }}>#{i + 1}</span>{r.name}</td>
          <td>{r.count}</td>
          <td className="num money strong">{fmt(r.total)}</td>
        </tr>
      ))}
      footer={<tr className="report-total-row"><td colSpan={2} className="text-right">Total Purchases</td><td className="num">{fmt(data.total)}</td></tr>}
    />
  );
}

function InventoryValuation({ onExport, onPdf }: { onExport: (rows: (string | number)[][]) => void; onPdf: (rows: (string | number)[][]) => void }) {
  const { data, err } = useReport<{ rows: any[]; total: number; totalRetail: number }>('/api/reports/inventory-valuation');
  if (err) return <Empty icon="reports" title="Failed to load" sub={err} />;
  if (!data) return <Skeleton height={300} />;

  const exportRows = () => onExport([
    ['SKU', 'Product', 'Category', 'Qty', 'Cost', 'Value', 'Retail Value'],
    ...data.rows.map((r) => [r.sku, r.name, r.category, r.qty, r.cost, r.value.toFixed(2), r.retailValue.toFixed(2)])
  ]);

  const pdfRows = () => onPdf([
    ['SKU', 'Product', 'Category', 'Qty', 'Unit Cost', 'Value', 'Retail Value'],
    ...data.rows.map((r) => [r.sku, r.name, r.category, r.qty, Number(r.cost.toFixed(2)), Number(r.value.toFixed(2)), Number(r.retailValue.toFixed(2))]),
    ['', 'TOTAL INVENTORY VALUE', '', '', '', Number(data.total.toFixed(2)), Number(data.totalRetail.toFixed(2))]
  ]);

  return (
    <ReportTable
      cols={['SKU', 'Product', 'Category', 'Qty', 'Unit Cost', 'Value (Cost)', 'Value (Retail)']}
      exportBtn={exportRows}
      pdfBtn={pdfRows}
      rows={data.rows.map((r) => (
        <tr key={r.id}>
          <td className="muted">{r.sku}</td>
          <td className="strong small">{r.name}</td>
          <td><Badge cls="badge-teal">{r.category}</Badge></td>
          <td className="num">{fmtQty(r.qty)}</td>
          <td className="num money">{fmt(r.cost)}</td>
          <td className="num money">{fmt(r.value)}</td>
          <td className="num money muted">{fmt(r.retailValue)}</td>
        </tr>
      ))}
      footer={<>
        <tr className="report-total-row"><td colSpan={5} className="text-right">Total Inventory Value</td><td className="num">{fmt(data.total)}</td><td className="num">{fmt(data.totalRetail)}</td></tr>
      </>}
    />
  );
}

function Aging({ onExport, onPdf }: { onExport: (rows: (string | number)[][]) => void; onPdf: (rows: (string | number)[][]) => void }) {
  const { data, err } = useReport<{ ar: any[]; ap: any[]; arBuckets: Record<string, number>; apBuckets: Record<string, number>; arTotal: number; apTotal: number }>('/api/reports/aging');
  if (err) return <Empty icon="reports" title="Failed to load" sub={err} />;
  if (!data) return <Skeleton height={300} />;

  const bucketOrder = ['current', '0-30', '31-60', '61-90', '90+'];
  const bucketLabel: Record<string, string> = { current: 'Current', '0-30': '1-30 days', '31-60': '31-60 days', '61-90': '61-90 days', '90+': '90+ days' };

  const exportRows = () => onExport([
    ['', 'Current', '1-30', '31-60', '61-90', '90+', 'Total'],
    ['Accounts Receivable', ...bucketOrder.map((b) => data.arBuckets[b] || 0), data.arTotal],
    ['Accounts Payable', ...bucketOrder.map((b) => data.apBuckets[b] || 0), data.apTotal]
  ]);

  const pdfRows = () => onPdf([
    ['', 'Current', '1-30', '31-60', '61-90', '90+', 'Total'],
    ['Accounts Receivable', ...bucketOrder.map((b) => Number((data.arBuckets[b] || 0).toFixed(2))), Number(data.arTotal.toFixed(2))],
    ['Accounts Payable', ...bucketOrder.map((b) => Number((data.apBuckets[b] || 0).toFixed(2))), Number(data.apTotal.toFixed(2))],
    ['', '', '', '', '', '', ''],
    ['Open items', 'Document', 'Due Date', 'Outstanding', '', '', 'Bucket'],
    ...[...data.ar, ...data.ap].map((r) => [r.kind === 'ar' ? 'Receivable' : 'Payable', r.docNumber, r.dueDate, Number(r.outstanding.toFixed(2)), '', '', r.bucket])
  ]);

  const section = (kind: 'ar' | 'ap', title: string, total: number) => (
    <>
      <tr className="report-group-row"><td colSpan={2}>{title} <span className="muted small">({data[kind].length} open items)</span></td></tr>
      {data[kind].map((r) => (
        <tr key={r.docNumber}>
          <td>{r.name}<span className="muted small"> · {r.docNumber}</span></td>
          <td className="num money">{fmt(r.outstanding)}</td>
        </tr>
      ))}
      <tr className="report-total-row"><td>Total {title}</td><td className="num">{fmt(total)}</td></tr>
    </>
  );

  return (
    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <ReportTable
        cols={['Aging Summary', 'Amount']}
        exportBtn={exportRows}
        pdfBtn={pdfRows}
        rows={<>
          {section('ar', 'Accounts Receivable', data.arTotal)}
          {section('ap', 'Accounts Payable', data.apTotal)}
        </>}
      />
      <div className="card card-pad">
        <div className="card-title mb-16">Age Breakdown</div>
        <div className="grid grid-2 mb-16">
          <div className="stat teal"><div className="stat-label">Receivables</div><div className="stat-value" style={{ fontSize: 18 }}>{fmt(data.arTotal)}</div></div>
          <div className="stat amber"><div className="stat-label">Payables</div><div className="stat-value" style={{ fontSize: 18 }}>{fmt(data.apTotal)}</div></div>
        </div>
        {['ar', 'ap'].map((kind) => (
          <div key={kind} className="mb-16">
            <div className="tiny muted mb-8 strong" style={{ textTransform: 'uppercase' }}>{kind === 'ar' ? 'Receivables' : 'Payables'}</div>
            {bucketOrder.map((b) => (
              <div key={b} className="flex-between small" style={{ padding: '4px 0' }}>
                <span className="muted">{bucketLabel[b]}</span>
                <span className="money strong">{fmt(data[kind === 'ar' ? 'arBuckets' : 'apBuckets'][b] || 0)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
