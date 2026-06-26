import { createHmac, timingSafeEqual } from 'crypto';

// Set AUTH_SECRET env var in Vercel for production security.
// Falls back to a dev secret when running locally.
const SECRET = process.env.AUTH_SECRET || 'address-book-dev-secret-change-me';
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export function checkCredentials(username, password) {
  const validUser = process.env.AUTH_USERNAME;
  const validPass = process.env.AUTH_PASSWORD;
  if (!validUser || !validPass) return false; // refuse login if env vars not set
  return username === validUser && password === validPass;
}

export function createToken(username) {
  const payload = Buffer.from(
    JSON.stringify({ user: username, exp: Date.now() + TOKEN_TTL_MS })
  ).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
  try {
    const a = Buffer.from(sig, 'base64url');
    const b = Buffer.from(expected, 'base64url');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function requireAuth(req, res) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
