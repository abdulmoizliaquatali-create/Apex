import crypto from 'node:crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'apex-local-dev-secret';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password ?? '')).digest('hex');
}

export function makeToken({ uid, role }) {
  const body = Buffer.from(JSON.stringify({ uid, role, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}

export function verifyToken(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const expect = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
    if (sig !== expect) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function bearerToken(req) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
}

// Strip the password hash (and any transient fields) before sending a user to
// the client.
export function safeUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

export const defaultPasswordFor = (role) => (role === 'admin' ? 'admin123' : role === 'accountant' ? 'accounts123' : 'sales123');
