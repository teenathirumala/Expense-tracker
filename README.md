# 💸 Expense Tracker — Full-Stack App with a Production-Style API

![Backend tests](https://github.com/teenathirumala/expense-tracker/actions/workflows/tests.yml/badge.svg)

A full-stack expense tracker: users sign up, log their spending, set a monthly budget and see where their money goes. The focus is the **backend**: a secure, validated, indexed and observable REST API with 44 automated tests.

**Live demo:** https://expense-tracker-one-woad.vercel.app
**API docs (Swagger):** https://YOUR-RENDER-URL.onrender.com/api/docs

> The API runs on Render's free tier, which sleeps when idle. The first request after a pause can take 30–50 seconds.

---

## ✨ Features

### Security
- **JWT authentication** with **bcrypt**-hashed passwords; every query is scoped to the logged-in user
- **Request validation with Zod** on every body, query string and URL parameter, with per-field error messages
- **NoSQL injection protection:** inputs must be the exact expected type, so operator objects like `{"$gt": ""}` are rejected with a 400
- **Mass-assignment protection:** unknown fields are stripped, and the owner always comes from the token
- **Rate limiting:** strict per-IP limit on login/register against brute-force attacks, plus a general API limit
- **CSV export** protected against spreadsheet formula injection

### Performance
- **Paginated expense list** with a stable sort (date + id tie-breaker) and a 100-item cap
- **Compound MongoDB indexes** designed around the real query patterns, verified with `explain()` in the tests
- **Aggregation pipelines** for category totals, daily/monthly spending trends and the monthly budget
- Page and total-count queries run in parallel, lean reads for list responses

### Reliability & observability
- **Structured JSON logging** (pino) with a **request ID** on every request, returned in the `X-Request-Id` header and in every error response
- **Central error handling:** consistent JSON errors (400, 404, 409, 413, 429); unexpected errors return a generic 500 and are logged with full details
- **Health check** that reports database status and returns 503 when MongoDB is unreachable
- **Graceful shutdown** on SIGTERM: finishes in-flight requests before closing the database connection
- **API documentation:** OpenAPI 3 spec with interactive Swagger UI at `/api/docs`

### App features
- Expenses CRUD with categories and date-range filtering
- Monthly budget with a progress bar and an overspending warning
- Charts for spending by category and over time
- CSV export of the filtered expenses

### Testing & CI
- **44 Jest + Supertest tests** against an in-memory MongoDB: auth, validation, injection attempts, user isolation, pagination, indexes, rate limiting, request IDs, error handling and docs
- Run automatically on every push and pull request with **GitHub Actions**

---

## 🛠 Tech Stack
| Layer    | Tech |
|----------|------|
| Backend  | Node.js, Express.js |
| Database | MongoDB Atlas, Mongoose (aggregation pipelines, compound indexes) |
| Auth     | JSON Web Tokens, bcryptjs |
| Validation & security | Zod, express-rate-limit |
| Logging  | pino, pino-http |
| Docs     | OpenAPI 3, Swagger UI |
| Testing  | Jest, Supertest, mongodb-memory-server |
| CI / Hosting | GitHub Actions, Render (API), Vercel (frontend) |
| Frontend | React, Vite, Recharts |

---

## 📁 Project Structure
```
expense-tracker/
├── .github/workflows/tests.yml   # CI: runs the backend tests on every push and PR
├── server/
│   ├── index.js                  # loads .env, connects to MongoDB, starts the server, graceful shutdown
│   ├── app.js                    # createApp(): middleware order, routes, 404 and error handler
│   ├── logger.js                 # pino structured logger
│   ├── middleware/
│   │   ├── auth.js               # verifies the JWT, sets req.userId
│   │   ├── validate.js           # runs Zod schemas on params/query/body, puts clean data on req.valid
│   │   ├── rateLimit.js          # per-IP rate limiter factory
│   │   └── requestLogger.js      # request IDs + one JSON log line per request
│   ├── validation/schemas.js     # Zod schemas for every request
│   ├── models/                   # User, Expense (with compound indexes)
│   ├── routes/                   # auth, expenses, budget
│   ├── utils/                    # MongoDB filter builder, CSV helpers
│   ├── docs/openapi.js           # OpenAPI 3 spec served at /api/docs
│   └── tests/api.test.js         # 44 Jest + Supertest tests
└── client/src/
    ├── api.js                    # fetch wrapper: adds the token, turns errors into messages
    └── components/               # AuthForm, Dashboard, ExpenseForm, BudgetCard, Charts
```

---

## 🔌 API

Interactive docs: **`/api/docs`**. Raw spec: **`/api/openapi.json`**.

All `/api/expenses` and `/api/budget` routes need `Authorization: Bearer <token>`. Dates are `YYYY-MM-DD`; `to` is inclusive.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/auth/register` | Create an account |
| POST   | `/api/auth/login` | Log in, returns a JWT |
| GET    | `/api/expenses?from&to&category&page&limit` | List expenses (paginated, newest first, max 100 per page) |
| POST   | `/api/expenses` | Add an expense |
| PUT    | `/api/expenses/:id` | Update an expense |
| DELETE | `/api/expenses/:id` | Delete an expense |
| GET    | `/api/expenses/summary?from&to` | Totals per category |
| GET    | `/api/expenses/trend?from&to` | Spending per day (ranges up to ~2 months) or per month |
| GET    | `/api/expenses/export?from&to&category` | Download as CSV |
| GET    | `/api/budget` | Budget status for the current month |
| PUT    | `/api/budget` | Set the monthly budget `{ "monthlyBudget": 15000 }` |
| GET    | `/api/health` | Health and database status |

### Response formats
**Paginated list**
```json
{
  "data": [ { "_id": "...", "title": "Groceries", "amount": 850, "category": "Food", "date": "2026-11-05T00:00:00.000Z" } ],
  "pagination": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 }
}
```
**Validation error (400)**
```json
{
  "message": "Validation failed",
  "errors": [ { "field": "amount", "message": "Amount cannot be negative" } ],
  "requestId": "3f1c2a9e-..."
}
```
Every response includes an `X-Request-Id` header that matches the server logs.

---

## 🚀 Run Locally
**Prerequisites:** Node.js 18+ and a MongoDB Atlas cluster (free tier works).

```bash
# Backend
cd server
cp .env.example .env        # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev                 # http://localhost:5001  (readable logs via pino-pretty)

# Frontend (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```
Then open **http://localhost:5001/api/docs** to explore the API.

### Environment variables (server)
| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `MONGO_URI` | ✅ | | MongoDB connection string |
| `JWT_SECRET` | ✅ | | Secret used to sign tokens |
| `PORT` | | 5001 | Port to listen on |
| `CLIENT_URL` | | `*` | Allowed frontend origin for CORS |
| `AUTH_RATE_LIMIT` | | 10 | Login/register attempts per IP per 15 min |
| `API_RATE_LIMIT` | | 300 | Other API requests per IP per 15 min |
| `LOG_LEVEL` | | info | `debug`, `info`, `warn`, `error` or `silent` |

---

## 🧪 Tests
```bash
cd server
npm test
```
The tests start a throwaway **in-memory MongoDB**, so they never touch real data and need no database setup. (The first run downloads a MongoDB binary, which takes a minute.)

---

## ☁️ Deployment
- **Backend → Render:** web service with root `server`, build `npm install`, start `npm start`, env vars `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`.
- **Frontend → Vercel:** root `client`, env var `VITE_API_URL` set to the Render URL.
- **MongoDB Atlas:** Render has no fixed outgoing IP on the free tier, so the network access list allows all IPs; access is protected by a dedicated database user and TLS.

---

## 🗺️ Roadmap

### Level 1 — Production basics ✅ Done
- [x] Request validation with **Zod** on every body, query and URL param (blocks NoSQL injection and mass assignment)
- [x] **Pagination** with stable ordering and a max page size of 100
- [x] **Compound MongoDB indexes** designed around the real query patterns, verified with `explain()`
- [x] **Rate limiting:** strict per-IP limit on login/register, general limit on the API
- [x] **Structured JSON logging** (pino) with a request ID on every request
- [x] **API docs:** OpenAPI 3 spec with Swagger UI at `/api/docs`
- [x] Health check with DB status, graceful shutdown, central error handling

### Level 2 — Backend engineering ✅ Done
- [x] **Load testing** with autocannon: baseline and before/after numbers in `server/docs/PERFORMANCE.md`
- [x] **Redis caching** for the analytics endpoints (cache-aside), cleared whenever expenses change, failing open if Redis is down
- [x] **Redis-backed rate limiting**, so limits hold across multiple server instances

### Future ideas
- [ ] Refresh tokens in httpOnly cookies (short-lived access tokens + rotation)
- [ ] Background jobs (BullMQ): recurring expenses and budget-alert emails, with retries

### Level 3 — DevOps & deployment 📋 Planned
- [ ] **Dockerfile** (multi-stage) and **Docker Compose** for API + MongoDB + Redis in one command
- [ ] **Kubernetes manifests:** Deployment, Service, ConfigMap/Secret, readiness and liveness probes
- [ ] **CI/CD pipeline:** run tests, build and push a Docker image, deploy on merge to `main`

---

## ⚠️ Known limitations
- Tokens are stored in `localStorage` and valid for 7 days (refresh tokens in httpOnly cookies are planned).
- Rate-limit counters live in one server's memory (Redis-backed limits are planned).
- The "current month" for the budget is calculated in UTC.