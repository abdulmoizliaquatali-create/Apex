export function BarChart({ labels, series, height = 220, colors = ['#0d9488'], money = false }: { labels: string[]; series: number[][]; height?: number; colors?: string[]; money?: boolean }) {
  const W = 600, H = height;
  const padL = 52, padB = 26, padT = 12, padR = 8;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(1, ...series.flat()) * 1.15;
  const n = labels.length;
  const step = iw / n;
  const barW = Math.min(40, (step * 0.62) / series.length);
  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const y = padT + ih - (ih * i) / ticks;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#eef1f6" strokeWidth="1" />
            <text x={padL - 8} y={y + 4} fontSize="10" fill="#8a97ab" textAnchor="end">{fmtTick((max * i) / ticks, money)}</text>
          </g>
        );
      })}
      {labels.map((lb, i) => (
        <text key={lb} x={padL + step * i + step / 2} y={H - 8} fontSize="10" fill="#8a97ab" textAnchor="middle">{lb}</text>
      ))}
      {series.map((arr, si) =>
        arr.map((v, i) => {
          const h = (v / max) * ih;
          const x = padL + step * i + step / 2 - barW / 2 - ((series.length - 1) * barW) / 2 + si * barW;
          const y = padT + ih - h;
          return <rect key={`${si}-${i}`} x={x} y={y} width={barW} height={h} rx="4" fill={colors[si % colors.length]} opacity={si > 0 ? 0.75 : 1} />;
        })
      )}
    </svg>
  );
}

export function AreaChart({ labels, series, height = 220, money = false }: { labels: string[]; series: number[]; height?: number; money?: boolean }) {
  const W = 600, H = height;
  const padL = 52, padB = 26, padT = 12, padR = 8;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(1, ...series) * 1.15;
  const step = iw / (labels.length - 1 || 1);
  const pts = series.map((v, i) => `${padL + step * i},${padT + ih - (v / max) * ih}`).join(' ');
  const area = `M${padL},${padT + ih} L${pts.split(' ').join(' L')} L${padL + iw},${padT + ih} Z`;
  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const y = padT + ih - (ih * i) / ticks;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#eef1f6" strokeWidth="1" />
            <text x={padL - 8} y={y + 4} fontSize="10" fill="#8a97ab" textAnchor="end">{fmtTick((max * i) / ticks, money)}</text>
          </g>
        );
      })}
      {labels.map((lb, i) => (
        <text key={lb} x={padL + step * i} y={H - 8} fontSize="10" fill="#8a97ab" textAnchor="middle">{lb}</text>
      ))}
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d9488" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaGrad)" />
      <polyline points={pts} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {series.map((v, i) => (
        <circle key={i} cx={padL + step * i} cy={padT + ih - (v / max) * ih} r="3.5" fill="#fff" stroke="#0d9488" strokeWidth="2.5" />
      ))}
    </svg>
  );
}

export function DonutChart({ data, size = 180, thickness = 26 }: { data: { label: string; value: number; color: string }[]; size?: number; thickness?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return <div className="empty small">No data</div>;
  const R = (size - thickness) / 2;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const cx = size / 2;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="#eef1f6" strokeWidth={thickness} />
        {data.map((d) => {
          const frac = d.value / total;
          const len = frac * C;
          const dash = `${len} ${C - len}`;
          const offset = -acc * C;
          acc += frac;
          return (
            <circle
              key={d.label} cx={cx} cy={cx} r={R} fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="butt"
              transform={`rotate(-90 ${cx} ${cx})`}
            />
          );
        })}
        <text x={cx} y={cx - 2} textAnchor="middle" fontSize="20" fontWeight="800" fill="#17233b">{total.toLocaleString('en-US')}</text>
        <text x={cx} y={cx + 16} textAnchor="middle" fontSize="10" fill="#8a97ab">Total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 130 }}>
        {data.map((d) => (
          <div key={d.label} className="flex-between" style={{ fontSize: 12 }}>
            <span className="flex"><span className="legend-dot" style={{ background: d.color }} />{d.label}</span>
            <span className="strong">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtTick(v: number, money: boolean) {
  if (money) {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
    return `$${Math.round(v)}`;
  }
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
}
