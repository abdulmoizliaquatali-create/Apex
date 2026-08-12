// API base. Defaults to a same-origin `/api` (Vite dev proxy -> :3001).
// For separate deployments (e.g. Netlify frontend + Render backend), set
// VITE_API_URL to the backend's absolute URL ending in `/api`, e.g.
//   VITE_API_URL=https://apex-backend-xell.onrender.com/api
const BASE: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  get: (path: string) => req(path),
  post: (path: string, body: unknown) => req(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: unknown) => req(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path: string) => req(path, { method: 'DELETE' })
};
