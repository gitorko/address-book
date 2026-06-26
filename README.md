# Address Book

Interactive 3D apartment directory for Meru & Meadow towers (Tower 6 and Tower 7).

The home page and directory are visible to all. Admin login is required to add or edit owner information.

## Run Locally

1. Install dependencies: `npm install`
2. Create `.env.local` with your admin login credentials:
   ```
   VITE_AUTH_USER=admin
   VITE_AUTH_PASS=your-password
   ```
3. `npm run dev` → open `http://localhost:5173`

> Data is saved to browser localStorage locally — no database needed.

## Deploy to Vercel

1. Push to GitHub and import the repo in [vercel.com](https://vercel.com).
2. Go to **Storage** → attach a **Postgres (Neon)** database.
3. Go to **Settings → Environment Variables** and add:

   | Variable | Value |
   |---|---|
   | `AUTH_USERNAME` | `admin` |
   | `AUTH_PASSWORD` | your password |
   | `AUTH_SECRET` | run `openssl rand -hex 32` |

4. Deploy.

**To change the password:** update `AUTH_PASSWORD` in Vercel env vars and redeploy.

## Seeding the Database

After deploying, sign in as admin and use **⋮ → Import data** to bulk-import from `address-book-data.json`.
The database tables (`owners`, `services`) are created automatically on first API call.
