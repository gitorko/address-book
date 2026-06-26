import { checkCredentials, createToken } from './_auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { username, password } = req.body || {};
  if (!checkCredentials(username, password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  return res.json({ token: createToken(username) });
}
