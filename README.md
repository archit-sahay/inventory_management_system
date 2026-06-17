# 📦 Inventory & Order Management System (IMS)

A production-ready, fully containerized full-stack application for managing
**products, customers, orders and inventory** — with automatic stock tracking
and order-time business rules.

| Layer | Technology |
| ----- | ---------- |
| Frontend | React 18 + Vite (JavaScript), React Router, Axios |
| Backend | Python 3.12 + FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| Database | PostgreSQL 16 |
| Containerization | Docker + Docker Compose (multi-stage builds, slim images) |

---

## ✨ Features

- **Dashboard** — totals for products, customers, orders, revenue + low-stock alerts.
- **Products** — full CRUD with unique SKU enforcement and stock status badges.
- **Customers** — create/list/delete with unique-email enforcement.
- **Orders** — multi-line orders, live total preview, server-side total calculation,
  inventory validation, automatic stock reduction, and stock restoration on cancel.
- **Activity Log** — read-only audit trail of every order placed and cancelled, with
  snapshotted details (customer, items, amount) that survive order deletion.
- **Responsive UI** — works on desktop and mobile, with form validation,
  auto-refresh on tab focus, and clear success/error toasts.
- **Interactive API docs** — Swagger UI at `/docs`, ReDoc at `/redoc`.

---

## 🧱 Project structure

```
ims/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── main.py          # app factory, CORS, lifespan, health checks
│   │   ├── config.py        # env-driven settings (no hardcoded secrets)
│   │   ├── database.py      # SQLAlchemy engine/session + DB-URL normalization
│   │   ├── models.py        # ORM models + DB constraints
│   │   ├── schemas.py       # Pydantic request/response validation
│   │   ├── seed.py          # optional demo data
│   │   └── routers/         # products, customers, orders, activity, dashboard
│   ├── tests/               # pytest API tests (CRUD + business rules)
│   ├── Dockerfile           # slim, non-root, production-ready
│   ├── .dockerignore
│   ├── requirements.txt
│   └── .env.example
├── frontend/                # React + Vite app
│   ├── src/
│   │   ├── api/client.js     # Axios client + error normalization
│   │   ├── components/       # Layout, Modal, Toast, StatCard, ...
│   │   └── pages/            # Dashboard, Products, Customers, Orders, ActivityLog
│   ├── Dockerfile           # multi-stage build → nginx
│   ├── nginx.conf           # SPA routing + gzip
│   ├── vercel.json          # Vercel SPA config
│   ├── .dockerignore
│   └── .env.example
├── docker-compose.yml       # frontend + backend + postgres (named volume)
├── render.yaml              # Render blueprint for backend + managed Postgres
├── .env.example             # root env for docker-compose
└── README.md
```

---

## 🚀 Quick start with Docker Compose (recommended)

> Requires Docker Desktop (with the Docker Compose plugin) running.

```bash
# 1. Clone and enter the repo
git clone <your-repo-url> ims && cd ims

# 2. Create your env file from the template (edit credentials as desired)
cp .env.example .env

# 3. Build and start everything
docker compose up --build
```

Then open:

| Service | URL |
| ------- | --- |
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |

`SEED_ON_STARTUP=true` (default) loads a handful of demo products and customers
on first run so the UI isn't empty. Set it to `false` for a clean database.

To stop and remove containers (data persists in the `pgdata` named volume):

```bash
docker compose down          # keep data
docker compose down -v       # also wipe the database volume
```

---

## 🛠️ Local development (without Docker)

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Point at a Postgres instance (or use SQLite for a quick spin):
export DATABASE_URL="postgresql+psycopg2://ims:ims@localhost:5432/ims"
# export DATABASE_URL="sqlite:///./dev.db"   # zero-setup alternative
export SEED_ON_STARTUP=true

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev        # http://localhost:5173
```

### Run the backend tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q          # runs against a throwaway SQLite DB, no services needed
```

---

## 🔌 API reference

Base URL: `http://localhost:8000` (or your deployed backend URL).

### Products
| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/products` | Create a product (unique SKU) → `201` |
| `GET` | `/products` | List all products |
| `GET` | `/products/{id}` | Get one product |
| `PUT` | `/products/{id}` | Update a product |
| `DELETE` | `/products/{id}` | Delete a product → `204` |

### Customers
| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/customers` | Create a customer (unique email) → `201` |
| `GET` | `/customers` | List all customers |
| `GET` | `/customers/{id}` | Get one customer |
| `DELETE` | `/customers/{id}` | Delete a customer → `204` |

### Orders
| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/orders` | Create an order (validates stock, reduces inventory) → `201` |
| `GET` | `/orders` | List all orders |
| `GET` | `/orders/{id}` | Get one order with line items |
| `DELETE` | `/orders/{id}` | Cancel an order (restores stock) → `204` |

### Activity log
| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/activity` | Read-only audit log of order events (placed / cancelled) |

### Dashboard / Health
| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/dashboard/summary` | Totals + low-stock products |
| `GET` | `/health` | Liveness/readiness probe |

**Create-order request body:**

```json
{
  "customer_id": 1,
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 3, "quantity": 1 }
  ]
}
```

The backend computes `unit_price`, `subtotal`, and `total_amount` itself — the
client never sends a price.

---

## 📐 Business rules (enforced server-side)

| Rule | Where |
| ---- | ----- |
| Product SKU is unique | Explicit check + DB `UNIQUE` constraint → `409` |
| Customer email is unique (case-insensitive) | Explicit check + DB `UNIQUE` → `409` |
| Product quantity can't be negative | Pydantic (`ge=0`) → `422` + DB `CHECK` |
| Orders blocked when stock is insufficient | Validated per line → `409` |
| Placing an order reduces stock | Atomic transaction with row locking |
| Order total computed by backend | From product prices × quantities |
| Cancelling an order restores stock | On `DELETE /orders/{id}` |
| All inputs validated; correct HTTP codes | Pydantic + FastAPI exception handlers |

HTTP status codes used: `200`, `201`, `204`, `404`, `409`, `422`, `503`.

---

## 🌍 Deployment guide (free hosting)

The app is split so the **backend deploys to Render** (with managed Postgres)
and the **frontend deploys to Vercel**. Both have generous free tiers.

### 1. Push to GitHub

```bash
git init && git add . && git commit -m "Initial commit: IMS full stack"
git branch -M main
git remote add origin https://github.com/<you>/ims.git
git push -u origin main
```

### 2. Backend → Render (with PostgreSQL)

This repo ships a [`render.yaml`](render.yaml) blueprint:

1. Render dashboard → **New + → Blueprint** → select your repo.
2. Render provisions **`ims-backend`** (Docker) **and** a free **`ims-db`** Postgres,
   wiring `DATABASE_URL` automatically.
3. After the frontend is live, set the backend's `CORS_ORIGINS` env var to your
   frontend URL (e.g. `https://your-app.vercel.app`) and redeploy.
4. Verify: open `https://ims-backend.onrender.com/docs`.

> Prefer Railway/Fly.io? Same idea: deploy `backend/Dockerfile`, attach a
> Postgres, and set `DATABASE_URL` + `CORS_ORIGINS`.

### 3. Frontend → Vercel

1. Vercel → **Add New → Project** → import your repo.
2. Set **Root Directory** to `frontend`. Framework preset: **Vite**.
3. Add an environment variable:
   `VITE_API_URL = https://ims-backend.onrender.com`
4. Deploy. Vercel runs `npm run build` and serves `dist/` (SPA routing handled
   by `vercel.json`).

> Netlify works identically: base directory `frontend`, build `npm run build`,
> publish `dist`, env var `VITE_API_URL`.

### 4. Docker Hub (backend image)

```bash
cd backend
docker build -t <dockerhub-user>/ims-backend:latest .
docker login
docker push <dockerhub-user>/ims-backend:latest
```

Image link: `https://hub.docker.com/r/<dockerhub-user>/ims-backend`

---

## 🔐 Configuration & secrets

All configuration is via **environment variables** — no credentials are
hardcoded. See `.env.example` (root), `backend/.env.example`, and
`frontend/.env.example`. Real `.env` files are git-ignored.

| Variable | Used by | Purpose |
| -------- | ------- | ------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | compose/db | Database credentials |
| `DATABASE_URL` | backend | SQLAlchemy connection string |
| `CORS_ORIGINS` | backend | Allowed frontend origins (`*` or CSV) |
| `LOW_STOCK_THRESHOLD` | backend | Low-stock cutoff for the dashboard |
| `SEED_ON_STARTUP` | backend | Insert demo data when DB is empty |
| `VITE_API_URL` | frontend | Backend base URL (baked in at build time) |

---

## ✅ Submission checklist

- [x] React frontend (responsive, validated, organized components)
- [x] Python/FastAPI backend with all required endpoints
- [x] PostgreSQL persistence
- [x] All business rules (unique SKU/email, stock validation, auto stock
      reduction, backend-computed totals, proper status codes)
- [x] Backend Dockerfile + frontend Dockerfile + `.dockerignore` files
- [x] `docker-compose.yml` (frontend + backend + Postgres, named volume)
- [x] Environment-variable configuration (no hardcoded credentials)
- [ ] GitHub repository link
- [ ] Docker Hub image link (backend)
- [ ] Live frontend URL (Vercel/Netlify)
- [ ] Live backend URL (Render/Railway/Fly.io)
```
