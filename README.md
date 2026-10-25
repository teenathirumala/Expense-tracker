# 💸 Expense Tracker — MERN Full Stack App

![Backend tests](https://github.com/teenathirumala/expense-tracker/actions/workflows/tests.yml/badge.svg)

A full-stack expense tracker where users sign up, log their spending, set a monthly budget, and see where their money goes with interactive charts.

**Live demo:** https://expense-tracker-one-woad.vercel.app/ **API:** https://expense-tracker-api-79eg.onrender.com

<!-- Add a screenshot or GIF here: ![Dashboard](docs/dashboard.png) -->

## ✨ Features
- **Authentication** — register / login with JWT and bcrypt-hashed passwords; every route is scoped to the logged-in user
- **Expenses CRUD** — add, edit, delete, and filter by category
- **Monthly budget alerts** — set a limit; the dashboard shows a progress bar that turns amber at 80% and red with a warning when you overspend
- **Interactive charts** (Recharts) — category breakdown (donut) and spending trend (bar), driven by a **date-range filter** with quick presets (This month / Last 30 days / This year). The trend switches automatically between daily and monthly grouping
- **CSV export** — download the filtered expenses, with proper escaping and protection against spreadsheet formula injection
- **Automated tests** — 18 Jest + Supertest API tests on an in-memory MongoDB, run on every push with GitHub Actions
- **Security touches** — input validation, NoSQL operator-injection guard on query params, centralized error handling

## 🛠 Tech Stack
| Layer    | Tech                                        |
|----------|---------------------------------------------|
| Frontend | React 18, Vite, Recharts, CSS               |
| Backend  | Node.js, Express.js                         |
| Database | MongoDB, Mongoose (aggregation pipelines)   |
| Auth     | JSON Web Tokens, bcryptjs                   |
| Testing  | Jest, Supertest, mongodb-memory-server      |
| CI       | GitHub Actions                              |

## 📁 Project Structure
```
expense-tracker/
├── .github/workflows/tests.yml   # CI: runs backend tests on every push
├── server/
│   ├── app.js                    # Express app (imported by tests)
│   ├── index.js                  # DB connection + server start
│   ├── models/                   # User (with monthlyBudget), Expense
│   ├── middleware/auth.js        # JWT verification
│   ├── routes/                   # auth, expenses, budget
│   ├── utils/                    # date-range filter builder, CSV helpers
│   └── tests/api.test.js         # Jest + Supertest
└── client/src/
    ├── api.js                    # fetch wrapper + file download
    ├── constants.js              # categories, colours, date/currency helpers
    └── components/               # AuthForm, Dashboard, ExpenseForm, BudgetCard, Charts
```

## 🔌 API Endpoints
All `/api/expenses` and `/api/budget` routes need `Authorization: Bearer <token>`.
`from` / `to` are `YYYY-MM-DD` and optional.

| Method | Endpoint                                   | Description                          |
|--------|--------------------------------------------|--------------------------------------|
| POST   | /api/auth/register                         | Create account                       |
| POST   | /api/auth/login                            | Log in, returns JWT                  |
| GET    | /api/expenses?from&to&category             | List expenses                        |
| POST   | /api/expenses                              | Add expense                          |
| PUT    | /api/expenses/:id                          | Update expense                       |
| DELETE | /api/expenses/:id                          | Delete expense                       |
| GET    | /api/expenses/summary?from&to              | Totals per category                  |
| GET    | /api/expenses/trend?from&to                | Spending per day or month            |
| GET    | /api/expenses/export?from&to&category      | Download as CSV                      |
| GET    | /api/budget                                | Budget status for the current month  |
| PUT    | /api/budget                                | Set budget `{ "monthlyBudget": 15000 }` |

## 🚀 Run Locally
**Prerequisites:** Node.js 18+, a free MongoDB Atlas cluster

```bash
# Backend
cd server
cp .env.example .env        # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev                 # http://localhost:5000

# Frontend (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

## 🧪 Run Tests
```bash
cd server
npm test
```
Tests use a throwaway in-memory MongoDB, so no database setup is needed. (The first run downloads a MongoDB binary, which takes a minute.)

## ☁️ Deploy (free)
1. Push to GitHub.
2. **Backend → Render:** New Web Service → root `server` → build `npm install` → start `npm start` → env vars `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` (your Vercel URL).
3. **Frontend → Vercel:** Import repo → root `client` → env var `VITE_API_URL` = your Render URL.
4. MongoDB Atlas → Network Access → allow `0.0.0.0/0`.


##  Future Improvements Roadmap

The project is being upgraded in three levels, from a working app to a production-style backend. Items are ticked off as they ship.

### Level 1 — Production basics 🚧 In progress
- [ ] Request validation with **Zod** on every body, query and URL param (blocks NoSQL injection)
- [ ] **Pagination** with stable ordering and a max page size of 100
- [ ] **Compound MongoDB indexes** designed around the real query patterns
- [ ] **Rate limiting** — strict per-IP limit on login/register, general limit on the API
- [ ] **Structured JSON logging** (pino) with a request ID on every request
- [ ] **API docs** — OpenAPI 3 spec with Swagger UI at `/api/docs`
- [ ] Health check with DB status, graceful shutdown, central error handling

### Level 2 — Backend engineering 📋 Planned
- [ ] **Refresh tokens** in httpOnly cookies (short-lived access tokens + rotation)
- [ ] **Redis caching** for analytics endpoints, cleared whenever expenses change
- [ ] **Redis-backed rate limiting** so limits hold across multiple server instances
- [ ] **Background jobs (BullMQ)** — recurring expenses (rent, subscriptions) and budget-alert emails, with retries
- [ ] Benchmark script to measure response times before and after caching

### Level 3 — DevOps & deployment 📋 Planned
- [ ] **Dockerfile** (multi-stage) and **Docker Compose** for API + MongoDB + Redis in one command
- [ ] **Kubernetes manifests** — Deployment, Service, ConfigMap/Secret, readiness and liveness probes
- [ ] **CI/CD pipeline** — run tests, build and push a Docker image, deploy on merge to `main`