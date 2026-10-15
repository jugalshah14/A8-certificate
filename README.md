# A8 Certificate

Monorepo with frontend and backend.

- `frontend/` — React + Vite
- `backend/` — Node.js + Express API

Requires Node.js 20+.

## Run

```bash
# backend (http://localhost:5000)
cd backend
cp .env.example .env
npm install
npm run dev

# frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Frontend dev server proxies `/api` to the backend.
