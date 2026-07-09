import { neon } from '@neondatabase/serverless';
import { checkCredentials, createToken } from './_auth.js';

const RETENTION = '30 days';

async function recordLogin(req, username, success) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`
      CREATE TABLE IF NOT EXISTS login_events (
        id BIGSERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        ip TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;
    const userAgent = req.headers['user-agent'] || null;
    await sql`
      INSERT INTO login_events (username, success, ip, user_agent)
      VALUES (${username}, ${success}, ${ip}, ${userAgent})
    `;
    await sql`DELETE FROM login_events WHERE created_at < now() - ${RETENTION}::interval`;
  } catch {
    // Auditing must never block login itself
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { username, password } = req.body || {};
  const ok = checkCredentials(username, password);
  await recordLogin(req, String(username ?? ''), ok);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  return res.json({ token: createToken(username) });
}
