# Address Book

3D apartment directory for Meru & Meadow towers. Admin login required to edit.

## Run Locally

```sh
npm install
npm run dev
```

Create `.env.local`:

```sh
VITE_AUTH_USER=admin
VITE_AUTH_PASS=your-password
```

Local data is stored in browser localStorage.

## Deploy (Vercel)

1. Import the repo in [vercel.com](https://vercel.com) and attach a **Postgres (Neon)** database under **Storage**.
2. Set env vars: `AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_SECRET` (`openssl rand -hex 32`).
3. Deploy, sign in as admin, and import `address-book-data.json` via **⋮ → Import data**.
