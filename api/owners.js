import { neon } from "@neondatabase/serverless";
import { requireAuth } from "./_auth.js";

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    )
  `;

  if (req.method === "GET") {
    // Public — no auth required; anyone can view the directory
    const rows = await sql`
      SELECT data FROM owners
      ORDER BY (data->>'tower')::int ASC, (data->>'floor')::int ASC, (data->>'house')::int ASC
    `;
    return res.json(rows.map((r) => r.data));
  }

  if (!requireAuth(req, res)) return;

  if (req.method === "POST") {
    const item = req.body;
    const id = `${item.tower}:${item.floor}:${item.house}`;
    await sql`
      INSERT INTO owners (id, data) VALUES (${id}, ${JSON.stringify(item)})
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    `;
    return res.status(201).json(item);
  }

  res.status(405).end();
}
