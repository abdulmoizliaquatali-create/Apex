import { FormEvent, useState } from 'react';
import { useAuth, ROLE_LABEL } from '../auth';
import { useTheme } from '../theme';
import { Icon } from '../components/ui';

const DEMO = [
  { role: 'admin', email: 'admin@apexgloves.com', password: 'admin123', name: 'Apex Administrator' },
  { role: 'accountant', email: 'accounts@apexgloves.com', password: 'accounts123', name: 'Accounts Team' },
  { role: 'viewer', email: 'salesdesk@apexgloves.com', password: 'sales123', name: 'Sales Desk' }
];

const ROLE_BADGE: Record<string, string> = { admin: 'badge-teal', accountant: 'badge-blue', viewer: 'badge-gray' };

export default function Login() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password || busy) return;
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message || 'Login failed');
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <button className="theme-btn" onClick={toggle} title="Toggle theme" aria-label="Toggle theme" style={{ position: 'fixed', top: 18, right: 18 }}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
      </button>

      <div className="login-card">
        <div className="boot-logo" style={{ width: 62, height: 62, fontSize: 28, borderRadius: 18 }}>A</div>
        <div className="login-title">Welcome back</div>
        <div className="login-sub">Sign in to Apex Gloves International</div>

        <form className="login-form" onSubmit={submit}>
          <label className="field-label">Email</label>
          <div className="input-icon">
            <Icon name="user" size={15} />
            <input className="input" type="email" placeholder="you@apexgloves.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="username" />
          </div>
          <label className="field-label">Password</label>
          <div className="input-icon">
            <Icon name="lock" size={15} />
            <input className="input" type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <div className="alert alert-err small">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !email || !password}>
            {busy ? <span className="btn-spin"><Icon name="refresh" size={15} /></span> : 'Sign in'}
          </button>
        </form>

        <div className="login-demo">
          <div className="login-demo-title">Demo accounts</div>
          {DEMO.map((d) => (
            <button key={d.role} className="login-demo-item" onClick={() => { setEmail(d.email); setPassword(d.password); setError(''); }}>
              <span className={`badge ${ROLE_BADGE[d.role]}`}>{ROLE_LABEL[d.role]}</span>
              <span className="grow">
                <span className="login-demo-email">{d.email}</span>
                <span className="tiny muted">{d.name}</span>
              </span>
              <span className="tiny muted">fill &amp; sign in</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
