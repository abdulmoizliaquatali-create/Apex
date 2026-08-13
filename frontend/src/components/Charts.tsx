import { useId } from 'react';

function fmtTick(v: number, money: boolean) {
  if (money) {
    const s = v < 0 ? '-' : '';
    const a = Math.abs(v);
    if (a >= 1000000) return `${s}$${(a / 1000000).toFixed(1)}M`;
    if (a >= 1000) return `${s}$${(a / 1000).toFixed(0)}k`;
    return `${s}$${Math.round(a)}`;
  }
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
}

export function BarChart({ labels, series, height = 230, colors = ['var(--primary-2)'], money = false, stacked = false }: { labels: string[]; series: number[][]; height?: number; colors?: string[]; money?: boolean; stacked?: boolean }) {
  const id = useId().replace(/:/g, '');
  const W = 600, H = height;
  const padL = 54, padB = 28, padT = 14, padR = 10;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(1, ...series.flat()) * 1.15;
  const n = Math.max(labels.length, 1);
  const step = iw / n;
  const groupW = step * 0.58;
  const barW = Math.min(42, (groupW - (series.length - 1) * 5) / series.length);
  const ticks = 4;
  const delay = (i: number, si: number) => `${(i * 0.05 + si * 0.04).toFixed(2)}s`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        {colors.map((c, si) => (
          <linearGradient key={si} id={`bg-${id}-${si}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} />
            <stop offset="100%" stopColor={c} stopOpacity="0.55" />
          </linearGradient>
        ))}
      </defs>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const y = padT + ih - (ih * i) / ticks;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={padL - 9} y={y + 4} fontSize="10.5" fontWeight="600" fill="var(--text-3)" textAnchor="end">{fmtTick((max * i) / ticks, money)}</text>
          </g>
        );
      })}
      {labels.map((lb, i) => (
        <text key={lb + i} x={padL + step * i + step / 2} y={H - 7} fontSize="10.5" fontWeight="600" fill="var(--text-3)" textAnchor="middle">{lb}</text>
      ))}
      {series.map((arr, si) =>
        arr.map((v, i) => {
          const h = Math.max(0, (v / max) * ih);
          const x = padL + step * i + step / 2 - groupW / 2 + si * (barW + 5);
          const y = padT + ih - h;
          const fill = `url(#bg-${id}-${si})`;
          return (
            <rect
              key={`${si}-${i}`} className="bar-rect" x={x} y={y} width={barW} height={h} rx="5"
              fill={fill} opacity={si > 0 ? 0.82 : 1}
              style={{ animationDelay: delay(i, si), ['--bar-opacity' as string]: si > 0 ? 0.82 : 1 }}
            />
          );
        })
      )}
    </svg>
  );
}

export function AreaChart({ labels, series, height = 220, money = false, stroke = 'var(--primary-2)' }: { labels: string[]; series: number[]; height?: number; money?: boolean; stroke?: string }) {
  const id = useId().replace(/:/g, '');
  const W = 600, H = height;
  const padL = 54, padB = 26, padT = 12, padR = 10;
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
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={padL - 9} y={y + 4} fontSize="10.5" fontWeight="600" fill="var(--text-3)" textAnchor="end">{fmtTick((max * i) / ticks, money)}</text>
          </g>
        );
      })}
      {labels.map((lb, i) => (
        <text key={lb + i} x={padL + step * i} y={H - 7} fontSize="10.5" fontWeight="600" fill="var(--text-3)" textAnchor="middle">{lb}</text>
      ))}
      <defs>
        <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#area-${id})`} className="area-fill" />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="spark-line" />
      {series.map((v, i) => (
        <circle key={i} cx={padL + step * i} cy={padT + ih - (v / max) * ih} r="3.5" fill="var(--surface-solid)" stroke={stroke} strokeWidth="2.5" />
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
    <div className="donut-wrap" style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="var(--track)" strokeWidth={thickness} />
        {data.map((d) => {
          const frac = d.value / total;
          const len = frac * C;
          const dash = `${len} ${C - len}`;
          const offset = -acc * C;
          acc += frac;
          return (
            <circle
              key={d.label} cx={cx} cy={cx} r={R} fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cx})`}
              style={{ animation: `donutDraw 0.9s cubic-bezier(0.18, 1.25, 0.4, 1) both`, animationDelay: `${acc * 0.4}s` }}
            />
          );
        })}
        <text x={cx} y={cx - 3} textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)">{total.toLocaleString('en-US')}</text>
        <text x={cx} y={cx + 15} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-3)">Total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 130 }}>
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

export function TrendLine({ data, height = 44 }: { data: number[]; height?: number }) {
  const W = 200, H = height;
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - 4 - ((v - min) / range) * (H - 8)}`).join(' ');
  const area = `M0,${H} L${pts.split(' ').join(' L')} L${W},${H} Z`;
  const id = useId().replace(/:/g, '');
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="spark">
      <defs>
        <linearGradient id={`tl-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary-2)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--primary-2)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#tl-${id})`} />
      <polyline points={pts} fill="none" stroke="var(--primary-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spark-line" />
    </svg>
  );
}
