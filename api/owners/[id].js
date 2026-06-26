import { neon } from "@neondatabase/serverless";
import { requireAuth } from "../_auth.js";

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const sql = neon(process.env.DATABASE_URL);
  const { id } = req.query;

  if (req.method === "PUT") {
    const item = req.body;
    await sql`UPDATE owners SET data = ${JSON.stringify(item)} WHERE id = ${id}`;
    return res.json(item);
  }

  if (req.method === "DELETE") {
    await sql`DELETE FROM owners WHERE id = ${id}`;
    return res.status(204).end();
  }

  res.status(405).end();
}
