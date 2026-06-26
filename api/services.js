import { neon } from "@neondatabase/serverless";
import { requireAuth } from "./_auth.js";

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    )
  `;

  if (req.method === "GET") {
    // Public — no auth required
    const rows = await sql`SELECT data FROM services ORDER BY id ASC`;
    return res.json(rows.map((r) => r.data));
  }

  if (!requireAuth(req, res)) return;

  if (req.method === "POST") {
    const item = req.body;
    await sql`
      INSERT INTO services (id, data) VALUES (${item.label}, ${JSON.stringify(item)})
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    `;
    return res.status(201).json(item);
  }

  res.status(405).end();
}
