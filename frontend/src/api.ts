// API base. Defaults to a same-origin `/api` (Vite dev proxy -> :3001).
// For separate deployments (e.g. Netlify frontend + Render backend), set
// VITE_API_URL to the backend's absolute URL ending in `/api`, e.g.
//   VITE_API_URL=https://apex-backend-xell.onrender.com/api
const BASE: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

// The session (token + user) is shared via localStorage so every request can
// carry the bearer token without importing the auth module directly.
function sessionToken(): string | undefined {
  try {
    const raw = localStorage.getItem('apex_session');
    return raw ? ((JSON.parse(raw) as { token?: string }).token) : undefined;
  } catch {
    return undefined;
  }
}

async function req(path: string, opts: RequestInit = {}) {
  const token = sessionToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { ...opts, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    if (res.status === 401) {
      try {
        localStorage.removeItem('apex_session');
        window.dispatchEvent(new Event('apex:unauthorized'));
      } catch {}
    }
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  get: (path: string) => req(path),
  post: (path: string, body: unknown) => req(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: unknown) => req(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path: string) => req(path, { method: 'DELETE' })
};
