# 📒 Ledgerly — Personal Finance Analytics API

**A production-style Node.js backend: validated, Redis-cached, load-tested, containerised and shipped through CI/CD.**

![Backend tests](https://github.com/teenathirumala/ledgerly/actions/workflows/tests.yml/badge.svg)

Ledgerly is a full-stack personal finance app: users sign up, log their spending, set a monthly budget and see where their money goes. The focus is the **backend**: a secure, validated, cached and observable REST API, load-tested and benchmarked, containerised with Docker, deployable to Kubernetes, and shipped through a CI/CD pipeline.

**Live demo:** https://expense-tracker-one-woad.vercel.app
**API docs (Swagger):** https://YOUR-RENDER-URL.onrender.com/api/docs
**Docker image:** `ghcr.io/teenathirumala/expense-tracker-api`

**Running in production:** Vercel (frontend) → Render (API) → MongoDB Atlas + **Upstash Redis** (TLS, same region as the API), so caching and shared rate limits are live, not just local.

> The live API runs on Render's free tier, which sleeps after 15 minutes idle. The first request after a pause can take up to a minute.

---

## ✨ Highlights

### Security
- **JWT authentication** with **bcrypt**-hashed passwords; every query is scoped to the logged-in user
- **Request validation with Zod** on every body, query string and URL parameter, with per-field error messages
- **NoSQL injection protection:** inputs must be the exact expected type, so operator objects like `{"$gt": ""}` are rejected with a 400
- **Mass-assignment protection:** unknown fields are stripped, and the owner always comes from the token
- **Rate limiting:** strict per-IP limit on login/register against brute-force attacks, plus a general API limit, **shared across server instances through Redis**
- CSV export protected against spreadsheet formula injection

### Performance
- **Redis caching (cache-aside)** for the analytics endpoints, invalidated on every write, with a TTL safety net and **fail-open** behaviour if Redis is down
- **Compound MongoDB indexes** designed around the real query patterns, verified with `explain()` in the tests
- **Paginated list** with a stable sort and a 100-item cap
- **Load-tested with autocannon:** caching improved analytics throughput **~5×** and cut p99 latency under load from **164 ms to 5 ms** ([benchmark details](server/docs/PERFORMANCE.md))

### Reliability & observability
- **Structured JSON logging** (pino) with a **request ID** on every request, returned in the `X-Request-Id` header and in error responses
- **Central error handling** with consistent JSON errors; unexpected errors return a generic 500 and are logged in full
- **Separate liveness and readiness checks:** `/api/live` (is the process alive?) and `/api/health` (can it reach the database? returns 503 if not)
- **Graceful shutdown** on SIGTERM: finishes in-flight requests before closing connections
- Starts without Redis if it's unavailable (no cache, in-memory rate limits) instead of crashing

### DevOps
- **Docker:** multi-stage image, non-root user, built-in health check, `npm ci` for reproducible installs
- **Docker Compose:** API + MongoDB + Redis with one command, health-gated startup and a persistent volume
- **Kubernetes manifests:** 2 API replicas behind a Service, rolling updates with zero downtime, readiness/liveness probes, CPU/memory requests and limits, ConfigMap + Secret, MongoDB with a persistent volume
- **CI/CD (GitHub Actions):** 54 integration tests against MongoDB and a Redis service container on every push and PR; on merge to `main`, a **multi-architecture image** (amd64 + arm64) is built and pushed to **GitHub Container Registry**, tagged with the commit SHA

### App features
- Expenses CRUD with categories and date-range filtering
- Monthly budget with a progress bar and an overspending warning
- Charts for spending by category and over time, and CSV export

---

## 🛠 Tech Stack
| Layer | Tech |
|---|---|
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose), aggregation pipelines, compound indexes |
| Cache & shared state | Redis (ioredis), rate-limit-redis |
| Auth & security | JSON Web Tokens, bcryptjs, Zod, express-rate-limit |
| Observability | pino, pino-http, request IDs, health/liveness endpoints |
| API docs | OpenAPI 3, Swagger UI |
| Testing | Jest, Supertest, mongodb-memory-server, ioredis-mock, autocannon (load testing) |
| Containers & orchestration | Docker, Docker Compose, Kubernetes |
| CI/CD & hosting | GitHub Actions, GitHub Container Registry, Render (API), Vercel (frontend), MongoDB Atlas, Upstash Redis |
| Frontend | React, Vite, Recharts |

---

## 🏗 Architecture
```
            ┌──────────────┐        ┌──────────────────────────────┐
 Browser ──▶│ React (Vite) │──API──▶│  Express API  (N replicas)   │
            └──────────────┘        │  validate → auth → route     │
                                    └──────┬───────────────┬───────┘
                                           │               │
                                   ┌───────▼──────┐  ┌─────▼──────────────────────┐
                                   │   MongoDB    │  │ Redis                      │
                                   │  (expenses,  │  │ • analytics cache          │
                                   │   users)     │  │ • shared rate-limit counts │
                                   └──────────────┘  └────────────────────────────┘
```
The API keeps no state of its own (JWT auth, cache and rate-limit counts in Redis), so it can run as many replicas as needed.

| Environment | Frontend | API | Database | Redis |
|---|---|---|---|---|
| **Live demo** | Vercel | Render | MongoDB Atlas | Upstash (TLS) |
| **Docker Compose** | Vite dev server | container | `mongo:7` container | `redis:7` container |
| **Kubernetes** | Vite dev server | 2-replica Deployment | Mongo + PVC | Redis Deployment |

---

## 📁 Project Structure
```
ledgerly/
├── .github/workflows/tests.yml   # CI: tests on every push/PR; CD: build + push image on main
├── docker-compose.yml            # API + MongoDB + Redis for local development
├── k8s/                          # Kubernetes manifests (namespace, config, Mongo, Redis, API)
│   └── examples/secret.example.yaml
├── server/
│   ├── Dockerfile                # multi-stage, non-root, health check
│   ├── index.js                  # connects MongoDB + Redis, starts the server, graceful shutdown
│   ├── app.js                    # createApp(): middleware order, routes, 404 and error handler
│   ├── cache.js                  # Redis cache-aside helpers (fail open)
│   ├── logger.js                 # pino structured logger
│   ├── middleware/               # auth (JWT), validate (Zod), rateLimit (Redis store), requestLogger
│   ├── validation/schemas.js     # Zod schemas for every request
│   ├── models/                   # User, Expense (with compound indexes)
│   ├── routes/                   # auth, expenses, budget
│   ├── utils/                    # MongoDB filter builder, CSV helpers
│   ├── docs/
│   │   ├── openapi.js            # OpenAPI 3 spec served at /api/docs
│   │   └── PERFORMANCE.md        # load-test method and before/after results
│   ├── scripts/seed.js           # seeds a load-test database (refuses to touch real data)
│   └── tests/api.test.js         # 54 Jest + Supertest integration tests
└── client/                       # React frontend
```

---

## 🔌 API
Interactive docs: **`/api/docs`**. Raw spec: **`/api/openapi.json`**.

All `/api/expenses` and `/api/budget` routes need `Authorization: Bearer <token>`. Dates are `YYYY-MM-DD`; `to` is inclusive.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET | `/api/expenses?from&to&category&page&limit` | List expenses (paginated, newest first, max 100 per page) |
| POST | `/api/expenses` | Add an expense |
| PUT | `/api/expenses/:id` | Update an expense |
| DELETE | `/api/expenses/:id` | Delete an expense |
| GET | `/api/expenses/summary?from&to` | Totals per category (cached) |
| GET | `/api/expenses/trend?from&to` | Spending per day or month (cached) |
| GET | `/api/expenses/export?from&to&category` | Download as CSV |
| GET | `/api/budget` | Budget status for the current month |
| PUT | `/api/budget` | Set the monthly budget `{ "monthlyBudget": 15000 }` |
| GET | `/api/health` | Readiness: server and database status (503 if the database is down) |
| GET | `/api/live` | Liveness: the process is running |

Cached responses include an `X-Cache: HIT` or `MISS` header. Every response includes an `X-Request-Id` that matches the server logs.

---

## 🚀 Run It

### Option 1: Docker Compose (easiest, no local MongoDB or Redis needed)
```bash
docker compose up --build        # API on http://localhost:5001, with MongoDB and Redis
cd client && npm install && npm run dev   # frontend on http://localhost:5173
```
Stop with `docker compose down` (add `-v` to also delete the database volume).

### Option 2: Kubernetes (Docker Desktop with Kubernetes enabled)
```bash
docker build -t expense-tracker-api:1.0.0 ./server
kubectl apply -f k8s/00-namespace.yaml
kubectl -n expense-tracker create secret generic api-secrets \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=MONGO_URI="mongodb://mongo:27017/expense-tracker"
kubectl apply -f k8s/
kubectl -n expense-tracker get pods      # 2 api pods + mongo + redis
```
The API is then available on `http://localhost:5001`. Remove everything with `kubectl delete namespace expense-tracker`.

### Option 3: Node.js directly
**Prerequisites:** Node.js 18+, MongoDB (Atlas or local), optionally Redis.
```bash
cd server
cp .env.example .env        # fill in MONGO_URI and JWT_SECRET (REDIS_URL optional)
npm install
npm run dev                 # http://localhost:5001 with readable logs
```

### Environment variables (server)
| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MONGO_URI` | ✅ | | MongoDB connection string |
| `JWT_SECRET` | ✅ | | Secret used to sign tokens |
| `REDIS_URL` | | | Enables caching and shared rate limits (the app runs without it) |
| `PORT` | | 5001 | Port to listen on |
| `CLIENT_URL` | | `*` | Allowed frontend origin for CORS |
| `AUTH_RATE_LIMIT` | | 10 | Login/register attempts per IP per 15 min |
| `API_RATE_LIMIT` | | 300 | Other API requests per IP per 15 min |
| `LOG_LEVEL` | | info | `debug`, `info`, `warn`, `error` or `silent` |

---

## 🧪 Tests
```bash
cd server
npm test                                             # 52 tests; the 2 Redis-store tests are skipped
TEST_REDIS_URL=redis://127.0.0.1:6379 npm test       # all 54, using a local Redis
```
Tests run against a throwaway **in-memory MongoDB** and never touch real data. In CI, a Redis service container runs the full suite.

**Load testing:** see [`server/docs/PERFORMANCE.md`](server/docs/PERFORMANCE.md) for the seed script, the exact commands, and before/after results with a control endpoint.

---

## 🔁 CI/CD Pipeline
```
push / pull request ──▶ test job: npm ci + 54 tests (MongoDB in memory, Redis service container)
merge to main ────────▶ test job ──▶ image job: build amd64 + arm64 image
                                     ──▶ push to ghcr.io/teenathirumala/expense-tracker-api
                                         tags: sha-<commit> (immutable) and latest
```
Deploy a specific version to Kubernetes by setting the image in `k8s/04-api.yaml` to a `sha-…` tag and running `kubectl apply -f k8s/`. Kubernetes performs a rolling update, and `kubectl rollout undo` rolls back.

---

## 🗺️ Roadmap

### Level 1 — Production basics ✅ Done
- [x] Request validation with **Zod** (blocks NoSQL injection and mass assignment)
- [x] **Pagination** with stable ordering and a max page size
- [x] **Compound MongoDB indexes**, verified with `explain()`
- [x] **Rate limiting** on login/register and the API
- [x] **Structured JSON logging** with request IDs
- [x] **API docs:** OpenAPI 3 + Swagger UI
- [x] Health check, graceful shutdown, central error handling

### Level 2 — Backend engineering ✅ Done (two items deferred)
- [x] **Load testing** with autocannon, with a baseline, a control endpoint and before/after results
- [x] **Redis caching** for analytics, invalidated on writes, fail-open
- [x] **Redis-backed rate limiting** shared across server instances
- [ ] **Refresh tokens** in httpOnly cookies with rotation and reuse detection (deferred)
- [ ] **Background jobs (BullMQ):** recurring expenses and budget-alert emails with retries (deferred)

### Level 3 — DevOps & deployment ✅ Done
- [x] **Dockerfile:** multi-stage, non-root, health check
- [x] **Docker Compose:** API + MongoDB + Redis
- [x] **Kubernetes manifests:** Deployment, Service, ConfigMap, Secret, readiness and liveness probes, rolling updates
- [x] **CI/CD:** tests, then a multi-arch image pushed to GHCR on merge to `main`

---

## ⚠️ Known limitations
- Tokens are stored in `localStorage` and valid for 7 days (refresh tokens are planned).
- The "current month" for the budget is calculated in UTC.
- The Kubernetes setup is for learning: MongoDB runs as a single Deployment (production would use a managed database or a StatefulSet), the API is exposed with a LoadBalancer Service rather than an Ingress with TLS, and Kubernetes Secrets are only base64-encoded by default.
- The free-tier API sleeps when idle, so the first request after a pause is slow (cold start).
## K8s architecture:
 Your Mac
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  Browser (localhost:5173, Vite)      curl localhost:5001                   │
 │            │                                │                              │
 │            └──────────────┬─────────────────┘                              │
 │                           ▼                                                │
 │  Kubernetes cluster (Docker Desktop, 1 node)                               │
 │  ┌──────────────────── namespace: expense-tracker ─────────────────────┐   │
 │  │                                                                      │   │
 │  │   Service "api"  (type LoadBalancer → localhost:5001)                │   │
 │  │      load-balances across READY api pods only                        │   │
 │  │            │                      │                                  │   │
 │  │            ▼                      ▼                                  │   │
 │  │   ┌───────────────┐      ┌───────────────┐     Deployment "api"      │   │
 │  │   │  api pod #1   │      │  api pod #2   │     replicas: 2           │   │
 │  │   │ image:        │      │ image:        │     rolling updates       │   │
 │  │   │ expense-      │      │ expense-      │     readiness: /api/health│   │
 │  │   │ tracker-api   │      │ tracker-api   │     liveness:  /api/live  │   │
 │  │   └──┬─────────┬──┘      └──┬─────────┬──┘                           │   │
 │  │      │ env from│            │         │                              │   │
 │  │      │ ConfigMap "api-config" (PORT, LOG_LEVEL, REDIS_URL…)          │   │
 │  │      │ Secret    "api-secrets" (JWT_SECRET, MONGO_URI)               │   │
 │  │      │         │            │         │                              │   │
 │  │      ▼         └────────┐   ▼         │                              │   │
 │  │   Service "mongo"       │ Service "redis"                            │   │
 │  │   (only reachable       │ (only reachable inside the cluster)        │   │
 │  │    inside the cluster)  │   │                                        │   │
 │  │      │                  │   ▼                                        │   │
 │  │      ▼                  │ ┌───────────┐  Deployment "redis"          │   │
 │  │   ┌───────────┐         │ │ redis pod │  cache + rate-limit counts   │   │
 │  │   │ mongo pod │         │ └───────────┘                              │   │
 │  │   └─────┬─────┘         │                                            │   │
 │  │         ▼               │                                            │   │
 │  │   PersistentVolumeClaim "mongo-data" (1 GiB, survives pod restarts)  │   │
 │  └──────────────────────────────────────────────────────────────────────┘   │
 └────────────────────────────────────────────────────────────────────────────┘

 GitHub: push → Actions runs tests → builds image → ghcr.io/teenathirumala/expense-tracker-api:sha-…
         (the cluster can pull that image instead of your locally built one)