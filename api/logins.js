import { neon } from "@neondatabase/serverless";
import { requireAuth } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  if (!requireAuth(req, res)) return;

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
  // Keep only the last 30 days of login history
  await sql`DELETE FROM login_events WHERE created_at < now() - interval '30 days'`;

  const rows = await sql`
    SELECT username, success, ip, user_agent, created_at
    FROM login_events
    ORDER BY created_at DESC
    LIMIT 500
  `;
  return res.json(
    rows.map((r) => ({
      username: r.username,
      success: r.success,
      ip: r.ip,
      userAgent: r.user_agent,
      at: new Date(r.created_at).toISOString(),
    }))
  );
}
