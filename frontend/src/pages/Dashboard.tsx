import { useData, fmt, fmtQty } from '../state';
import { Stat, Icon, Empty } from '../components/ui';
import { BarChart, DonutChart } from '../components/Charts';
import { Link } from 'react-router-dom';

const CAT_COLORS: Record<string, string> = {
  'Disposable': '#0d9488', 'Work': '#2563eb', 'Cut-Resistant': '#d97706', 'Leather': '#7c3aed',
  'Welding': '#dc2626', 'Winter': '#0ea5e9', 'Knit': '#16a34a', 'Household': '#f59e0b',
  'Chemical': '#6366f1', 'Other': '#8a97ab'
};

export default function Dashboard() {
  const { dashboard, settings, products } = useData();
  if (!dashboard) return <div className="skeleton" style={{ height: 400 }} />;

  const k = dashboard.kpi;
  const catData = Object.entries(dashboard.invByCategory).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: CAT_COLORS[label] || '#8a97ab' }));
  const totalUnits = products.reduce((s, p) => s + p.qty, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const companyName = settings?.company?.name || 'Apex team';

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">{greeting}, {companyName}</div>
          <div className="page-sub">Here's how your glove business is performing · {settings.company.city}, {settings.company.country}</div>
        </div>
        <Link to="/sales/invoices" className="btn btn-primary"><Icon name="plus" size={15} /> New Invoice</Link>
      </div>

      <div className="grid grid-4">
        <Stat tone="teal" icon="money" label="Revenue (YTD)" value={fmt(k.revenue)} foot={`${fmt(k.monthRevenue)} in ${dashboard.monthLabel}`} />
        <Stat tone="green" icon="trend" label="Net Profit" value={fmt(k.revenue - k.expense)} foot="Revenue minus COGS & expenses" />
        <Stat tone="amber" icon="wallet" label="Cash on Hand" value={fmt(k.cash)} foot="Main business account" />
        <Stat tone="red" icon="box" label="Inventory Value" value={fmt(k.invValue)} foot={`${fmtQty(totalUnits)} units on hand`} />
      </div>

      <div className="grid grid-4 mt-16">
        <Stat tone="blue" icon="customers" label="Accounts Receivable" value={fmt(k.ar)} foot={`${k.openInvoices} open invoices`} />
        <Stat tone="purple" icon="suppliers" label="Accounts Payable" value={fmt(k.ap)} foot={`${k.openBills} open bills`} />
        <Stat tone="teal" icon="sales" label="Customers" value={String(k.customers)} foot="6 export · local mix" />
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
              <span><span className="legend-dot" style={{ background: '#d97706' }} />Supplier Bills</span>
            </div>
          </div>
          <BarChart labels={dashboard.chart.labels} series={[dashboard.chart.revenue, dashboard.chart.expense]} money colors={['#0d9488', '#f59e0b']} />
        </div>

        <div className="card card-pad">
          <div className="card-title mb-16">Sales by Glove Category</div>
          {catData.length ? <DonutChart data={catData} /> : <Empty icon="box" title="No sales yet" />}
        </div>
      </div>

      <div className="grid mt-16" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <div className="flex-between" style={{ padding: '18px 20px 0' }}>
            <div className="card-title">Low Stock Alerts</div>
            <Link to="/products" className="btn btn-ghost btn-sm">View all</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th className="num">On Hand</th><th className="num">Reorder</th><th></th></tr></thead>
              <tbody>
                {dashboard.lowStock.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td><span className="strong small">{p.name}</span><div className="tiny muted">{p.sku}</div></td>
                    <td className="num money">{fmtQty(p.qty)}</td>
                    <td className="num money">{fmtQty(p.reorder)}</td>
                    <td><span className="badge badge-red"><span className="badge-dot" />Reorder</span></td>
                  </tr>
                ))}
                {!dashboard.lowStock.length && <tr><td colSpan={4} className="text-center muted small" style={{ padding: 28 }}>All products above reorder level</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="flex-between" style={{ padding: '18px 20px 0' }}>
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
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
