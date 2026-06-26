import { neon } from "@neondatabase/serverless";
import { requireAuth } from "../_auth.js";

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const sql = neon(process.env.DATABASE_URL);
  const { id } = req.query; // original label (URL-decoded by Vercel)

  if (req.method === "PUT") {
    const item = req.body;
    // Delete old record and insert new one to handle label renames
    await sql`DELETE FROM services WHERE id = ${id}`;
    await sql`INSERT INTO services (id, data) VALUES (${item.label}, ${JSON.stringify(item)})`;
    return res.json(item);
  }

  if (req.method === "DELETE") {
    await sql`DELETE FROM services WHERE id = ${id}`;
    return res.status(204).end();
  }

  res.status(405).end();
}
