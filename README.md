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

## 🔮 Future Improvements
- Recurring expenses (rent, subscriptions)
- Per-category budgets
- Refresh tokens and httpOnly cookies instead of localStorage
- Frontend tests with React Testing Library
