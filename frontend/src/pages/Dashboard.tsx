import { useData, fmt, fmtQty } from '../state';
import { Stat, Icon, Empty, CountUp, Progress } from '../components/ui';
import { BarChart, DonutChart } from '../components/Charts';
import { Link } from 'react-router-dom';

const CAT_COLORS: Record<string, string> = {
  'Disposable': '#0d9488', 'Work': '#2563eb', 'Cut-Resistant': '#d97706', 'Leather': '#7c3aed',
  'Welding': '#dc2626', 'Winter': '#0ea5e9', 'Knit': '#16a34a', 'Household': '#f59e0b',
  'Chemical': '#6366f1', 'Other': '#8a97ab'
};

function pctChange(series: number[]): number {
  if (series.length < 2) return 0;
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  if (!prev) return 0;
  return Math.round(((last - prev) / Math.abs(prev)) * 100);
}

export default function Dashboard() {
  const { dashboard, settings, products } = useData();
  if (!dashboard) return <div className="skeleton" style={{ height: 400 }} />;

  const k = dashboard.kpi;
  const rev = dashboard.chart.revenue;
  const exp = dashboard.chart.expense;
  const profitSeries = rev.map((r, i) => r - (exp[i] || 0));
  const catData = Object.entries(dashboard.invByCategory).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: CAT_COLORS[label] || '#8a97ab' }));
  const totalUnits = products.reduce((s, p) => s + p.qty, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const companyName = settings?.company?.name || 'Apex team';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const netProfit = k.revenue - k.expense;

  return (
    <div>
      <div className="hero">
        <div className="hero-body">
          <div className="hero-kicker"><Icon name="pin" size={12} /> {dateStr}</div>
          <div className="hero-title">{greeting}, {companyName}!</div>
          <div className="hero-sub">Here's how your glove business is performing · {settings.company.city}, {settings.company.country}</div>
        </div>
        <div className="hero-actions">
          <Link to="/sales/invoices" className="btn btn-light"><Icon name="plus" size={15} /> New Invoice</Link>
          <Link to="/reports" className="btn btn-glass"><Icon name="reports" size={15} /> View Reports</Link>
        </div>
      </div>

      <div className="grid grid-4">
        <Stat tone="teal" icon="money" label="Revenue (YTD)" delta={pctChange(rev)} spark={rev}
          value={<CountUp value={k.revenue} format={fmt} />}
          foot={`${fmt(k.monthRevenue)} in ${dashboard.monthLabel}`} />
        <Stat tone="green" icon="trend" label="Net Profit" delta={pctChange(profitSeries)} spark={profitSeries}
          value={<CountUp value={netProfit} format={fmt} />}
          foot="Revenue minus COGS & expenses" />
        <Stat tone="amber" icon="wallet" label="Cash on Hand"
          value={<CountUp value={k.cash} format={fmt} />}
          foot="Across all bank accounts" />
        <Stat tone="red" icon="box" label="Inventory Value"
          value={<CountUp value={k.invValue} format={fmt} />}
          foot={`${fmtQty(totalUnits)} units on hand`} />
      </div>

      <div className="grid grid-4 mt-16">
        <Stat tone="blue" icon="customers" label="Accounts Receivable" value={fmt(k.ar)} foot={`${k.openInvoices} open invoices`} />
        <Stat tone="purple" icon="suppliers" label="Accounts Payable" value={fmt(k.ap)} foot={`${k.openBills} open bills`} />
        <Stat tone="teal" icon="sales" label="Customers" value={String(k.customers)} foot="Export & local customer mix" />
        <Stat tone="amber" icon="box" label="Products" value={String(k.products)} foot="Across 9 glove categories" />
      </div>

      <div className="grid mt-16" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card card-pad">
          <div className="flex-between mb-16">
            <div>
              <div className="card-title">Revenue vs Purchases</div>
              <div className="card-sub">Monthly revenue vs supplier bills, in {settings.baseCurrency}</div>
            </div>
            <div className="chart-legend">
              <span><span className="legend-dot" style={{ background: '#0d9488' }} />Sales Revenue</span>
              <span><span className="legend-dot" style={{ background: '#f59e0b' }} />Supplier Bills</span>
            </div>
          </div>
          <BarChart labels={dashboard.chart.labels} series={[rev, exp]} money colors={['#0d9488', '#f59e0b']} />
        </div>

        <div className="card card-pad">
          <div className="card-title mb-16">Sales by Glove Category</div>
          {catData.length ? <DonutChart data={catData} /> : <Empty icon="box" title="No sales yet" />}
        </div>
      </div>

      <div className="grid mt-16" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <div className="flex-between" style={{ padding: '20px 22px 0' }}>
            <div className="card-title">Low Stock Alerts</div>
            <Link to="/products" className="btn btn-ghost btn-sm">View all</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th style={{ width: 170 }}>Stock level</th><th className="num">On Hand</th><th></th></tr></thead>
              <tbody>
                {dashboard.lowStock.slice(0, 5).map((p) => {
                  const pct = Math.min(100, (p.qty / p.reorder) * 100);
                  return (
                    <tr key={p.id}>
                      <td><span className="strong small">{p.name}</span><div className="tiny muted">{p.sku}</div></td>
                      <td style={{ width: 170 }}><Progress value={pct} color={pct <= 40 ? 'var(--danger)' : 'var(--warning)'} height={6} /></td>
                      <td className="num money">{fmtQty(p.qty)} <span className="tiny muted">/ {fmtQty(p.reorder)}</span></td>
                      <td><span className="badge badge-red"><span className="badge-dot" />Reorder</span></td>
                    </tr>
                  );
                })}
                {!dashboard.lowStock.length && <tr><td colSpan={4} className="text-center muted small" style={{ padding: 32 }}>All products above reorder level</td></tr>}
              </tbody>
            </table>
          </div>
          {dashboard.lowStock.length > 0 && (
            <div className="tiny muted" style={{ padding: '12px 22px 18px' }}>
              {dashboard.lowStock.length} of {products.length} products at or below reorder point
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex-between" style={{ padding: '20px 22px 0' }}>
            <div className="card-title">Recent Transactions</div>
            <Link to="/accounting/journal" className="btn btn-ghost btn-sm">Journal</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Memo</th><th>Ref</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {dashboard.recent.slice(0, 6).map((t) => (
                  <tr key={t.id}>
                    <td className="muted small">{t.date}</td>
                    <td className="small">{t.memo}</td>
                    <td className="small muted">{t.ref}</td>
                    <td className="num money strong">{fmt(t.amount)}</td>
                  </tr>
                ))}
                {!dashboard.recent.length && <tr><td colSpan={4} className="text-center muted small" style={{ padding: 32 }}>No transactions yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
