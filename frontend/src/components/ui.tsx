import { ReactNode, CSSProperties, useRef, useEffect } from 'react';
import { fmt, curSymbol } from '../state';
import type { Currency } from '../types';

export function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
    sales: <><path d="M3 3h2l.4 2M7 13h10l4-8H5.4" /><path d="M7 13 5.4 5H3" /><circle cx="9" cy="21" r="1" /><circle cx="19" cy="21" r="1" /></>,
    purchases: <><path d="M2 4h20l-2 6H4L2 4z" /><path d="M4 10v10h16V10" /><path d="M9 14h6" /></>,
    box: <><path d="M21 8 12 3 3 8v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" /></>,
    customers: <><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    suppliers: <><path d="M20 12V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10" /><path d="M18 14v6" /><path d="M21 17h-6" /><circle cx="6" cy="12" r="1" /></>,
    bank: <><path d="M3 21h18" /><path d="M4 18h16" /><path d="M5 14V9" /><path d="M9.5 14V9" /><path d="M14.5 14V9" /><path d="M19 14V9" /><path d="m2 7 10-4 10 4" /></>,
    accounting: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 8h10" /><path d="M7 12h6" /><path d="M7 16h8" /></>,
    reports: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
    edit: <><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></>,
    trash: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 8 5-5 5 5" /><path d="M12 3v12" /></>,
    money: <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></>,
    globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
    printer: <><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
    ship: <><path d="M3 15c3 2 4 2 6 0s3-2 6 0 3 2 6 0" /><path d="M3 19c3 2 4 2 6 0s3-2 6 0 3 2 6 0" /><path d="M3 11V4h12v7" /><path d="M3 11h18v4" /><path d="M15 4l3 3 3-3" /></>,
    trend: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
    alert: <><path d="m21.7 18-9-15.5a1 1 0 0 0-1.7 0l-9 15.5A1 1 0 0 0 2.8 20h18.4a1 1 0 0 0 .8-1.5z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
    arrowLeft: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
    ship2: <><path d="M22 18H2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4z" /><path d="M2 18v-3h20v3" /><path d="M5 15l2-7h10l2 7" /><path d="M9 8V4h6v4" /></>,
    doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /></>,
    filter: <><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></>,
    check: <><path d="M20 6 9 17l-5-5" /></>,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
    refresh: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>,
    wallet: <><path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" /><path d="M16 12h6v6h-6a3 3 0 0 1 0-6z" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    history: <><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></>,
    statement: <><path d="M4 2v20" /><path d="M8 6h8" /><path d="M8 10h8" /><path d="M8 14h5" /><path d="M8 18h8" /><path d="M18 22l4-4" /></>
  };
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || paths.doc}
    </svg>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <div className="page-title">{title}</div>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {actions && <div className="flex">{actions}</div>}
    </div>
  );
}

export function Badge({ cls, children }: { cls: string; children: ReactNode }) {
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function Modal({ title, children, foot, onClose, size }: { title: ReactNode; children: ReactNode; foot?: ReactNode; onClose: () => void; size?: 'sm' | 'lg' }) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : size === 'sm' ? 'modal-sm' : ''}`}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="close-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, foot, tone, icon }: { label: string; value: ReactNode; foot?: ReactNode; tone?: string; icon?: string }) {
  return (
    <div className={`stat ${tone || 'teal'}`}>
      <div className="stat-label">{icon && <Icon name={icon} size={15} />}{label}</div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

export function Empty({ icon = 'box', title, sub, action }: { icon?: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={26} /></div>
      <div className="empty-title">{title}</div>
      {sub && <div className="small" style={{ marginTop: 4 }}>{sub}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Money({ value, symbol = '$', cls = 'money' }: { value: number; symbol?: string; cls?: string }) {
  return <span className={cls}>{fmt(value, symbol)}</span>;
}

// Animated number — counts up to the target on mount with ease-out, respecting reduced motion.
export function CountUp({ value, format, duration = 650 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prevRef.current;
    const to = value;
    prevRef.current = to;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = format ? format(to) : String(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = from + (to - from) * eased;
      el.textContent = format ? format(current) : String(Math.round(current));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, format, duration]);
  return <span ref={ref} />;
}

export function MoneyCell({ value, currency, currencies }: { value: number; currency: string; currencies: Currency[] }) {
  return <span className="money">{fmt(value, curSymbol(currency, currencies))}</span>;
}

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Skeleton({ width = '100%', height = 14, style }: { width?: string | number; height?: number; style?: CSSProperties }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

export function Loader({ size = 26, light = false }: { size?: number; light?: boolean }) {
  return <div className={`loader ${light ? 'loader-light' : ''}`} style={{ width: size, height: size }} />;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="text-center" style={{ padding: 60 }}>
      <Loader size={34} />
      {label && <div className="tiny muted mt-8">{label}</div>}
    </div>
  );
}

// Full-page skeleton shown while the app is booting or a page is refreshing.
export function PageLoader() {
  return (
    <div className="page-loader">
      <div className="page-loader-head">
        <div>
          <Skeleton width={220} height={22} />
          <Skeleton width={340} height={13} style={{ marginTop: 10 }} />
        </div>
        <Skeleton width={120} height={36} />
      </div>
      <div className="grid grid-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 108 }} />)}
      </div>
      <div className="grid mt-16" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="skeleton" style={{ height: 260 }} />
        <div className="skeleton" style={{ height: 260 }} />
      </div>
      <div className="grid mt-16" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="skeleton" style={{ height: 220 }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    </div>
  );
}

export function Toast({ type, message }: { type: 'success' | 'error'; message: string }) {
  return <div className={`toast ${type}`}><Icon name={type === 'success' ? 'check' : 'alert'} size={16} />{message}</div>;
}
