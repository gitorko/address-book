import { neon } from "@neondatabase/serverless";
import { requireAuth } from "./_auth.js";

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  const sql = neon(process.env.DATABASE_URL);

  if (req.method === "DELETE") {
    await sql`CREATE TABLE IF NOT EXISTS owners (id TEXT PRIMARY KEY, data JSONB NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, data JSONB NOT NULL)`;

    const ownersDeleted = await sql`DELETE FROM owners RETURNING id`;
    const servicesDeleted = await sql`DELETE FROM services RETURNING id`;

    return res.json({
      ownersDeleted: ownersDeleted.length,
      servicesDeleted: servicesDeleted.length,
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  const { flats = [], services = [] } = req.body || {};

  // Ensure tables exist
  await sql`CREATE TABLE IF NOT EXISTS owners (id TEXT PRIMARY KEY, data JSONB NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, data JSONB NOT NULL)`;

  let ownersImported = 0;
  let servicesImported = 0;

  for (const item of flats) {
    if (!item.tower || !item.floor || !item.house) continue;
    const id = `${item.tower}:${item.floor}:${item.house}`;
    await sql`
      INSERT INTO owners (id, data) VALUES (${id}, ${JSON.stringify(item)})
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    `;
    ownersImported++;
  }

  for (const item of services) {
    if (!item.label) continue;
    await sql`
      INSERT INTO services (id, data) VALUES (${item.label}, ${JSON.stringify(item)})
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    `;
    servicesImported++;
  }

  return res.json({ ownersImported, servicesImported });
}
