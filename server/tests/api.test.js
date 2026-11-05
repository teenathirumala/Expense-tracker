import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { createApp } from "../app.js";
// Huge limits for the normal tests: this file signs up many users, which would otherwise hit the 10-per-15-minutes login limit.
const app = createApp({ authLimit: 10_000, apiLimit: 10_000 });

import Expense from "../models/Expense.js";

// Each test run spins up a throwaway in-memory MongoDB, so no real database is touched.
let mongo;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

// ---------- helpers ----------
async function signup(email = "asha@test.com") {
  const res = await request(app).post("/api/auth/register").send({ name: "Asha", email, password: "secret123" });
  return res.body.token;
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

function addExpense(token, data = {}) {
  return request(app)
    .post("/api/expenses")
    .set(bearer(token))
    .send({ title: "Lunch", amount: 200, category: "Food", ...data });
}

// ---------- auth ----------
describe("Auth", () => {
  test("registers a user and never returns the password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Asha", email: "asha@test.com", password: "secret123" });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.password).toBeUndefined();
  });

  test("rejects a duplicate email", async () => {
    await signup();
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Asha", email: "asha@test.com", password: "secret123" });
    expect(res.status).toBe(409);
  });

  test("rejects a wrong password", async () => {
    await signup();
    const res = await request(app).post("/api/auth/login").send({ email: "asha@test.com", password: "wrong-pass" });
    expect(res.status).toBe(401);
  });

  test("logs in with the right password", async () => {
    await signup();
    const res = await request(app).post("/api/auth/login").send({ email: "asha@test.com", password: "secret123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

    test("rejects a MongoDB operator as the email (NoSQL injection)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: { $gt: "" }, password: "anything" });

    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toEqual({ field: "email", message: "Email must be text" });
  });

  test("lists every invalid field when registering", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "", email: "not-an-email", password: "123" });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field).sort()).toEqual(["email", "name", "password"]);
  });

  test("cleans the email before login (spaces and capitals)", async () => {
    await signup("asha@test.com");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "  ASHA@Test.com ", password: "secret123" });

    expect(res.status).toBe(200);
  });
});

// ---------- expenses ----------
describe("Expenses", () => {
  test("blocks requests without a token", async () => {
    const res = await request(app).get("/api/expenses");
    expect(res.status).toBe(401);
  });

  test("creates and lists an expense", async () => {
    const token = await signup();
    const created = await addExpense(token, { title: "Groceries", amount: 850 });
    expect(created.status).toBe(201);

    const res = await request(app).get("/api/expenses").set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ title: "Groceries", amount: 850, category: "Food" });
  });

  test("rejects an expense with no title", async () => {
    const token = await signup();
    const res = await request(app).post("/api/expenses").set(bearer(token)).send({ amount: 50 });
    expect(res.status).toBe(400);
  });

  test("rejects a negative amount", async () => {
    const token = await signup();
    const res = await addExpense(token, { amount: -10 });
    expect(res.status).toBe(400);
  });

  test("updates and deletes an expense", async () => {
    const token = await signup();
    const { body: expense } = await addExpense(token);

    const updated = await request(app)
      .put(`/api/expenses/${expense._id}`)
      .set(bearer(token))
      .send({ title: "Dinner", amount: 500, category: "Food" });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe("Dinner");

    const deleted = await request(app).delete(`/api/expenses/${expense._id}`).set(bearer(token));
    expect(deleted.status).toBe(200);

    const list = await request(app).get("/api/expenses").set(bearer(token));
    expect(list.body.data).toHaveLength(0);
  });

  test("users cannot see or delete each other's expenses", async () => {
    const alice = await signup("alice@test.com");
    const bob = await signup("bob@test.com");
    const { body: aliceExpense } = await addExpense(alice);

    const bobList = await request(app).get("/api/expenses").set(bearer(bob));
    expect(bobList.body.data).toHaveLength(0);

    const bobDelete = await request(app).delete(`/api/expenses/${aliceExpense._id}`).set(bearer(bob));
    expect(bobDelete.status).toBe(404);
  });

  test("filters by date range (end date inclusive)", async () => {
    const token = await signup();
    await addExpense(token, { title: "September rent", date: "2026-09-30" });
    await addExpense(token, { title: "October rent", date: "2026-10-31" });

    const res = await request(app).get("/api/expenses?from=2026-10-01&to=2026-10-31").set(bearer(token));
    expect(res.body.data.map((e) => e.title)).toEqual(["October rent"]);
  });

  test("rejects an invalid date and an unknown category", async () => {
    const token = await signup();
    const badDate = await request(app).get("/api/expenses?from=not-a-date").set(bearer(token));
    expect(badDate.status).toBe(400);

    const badCategory = await request(app).get("/api/expenses?category[$ne]=Food").set(bearer(token));
    expect(badCategory.status).toBe(400);
  });

  test("summarises totals per category", async () => {
    const token = await signup();
    await addExpense(token, { amount: 200, category: "Food" });
    await addExpense(token, { amount: 300, category: "Food" });
    await addExpense(token, { amount: 100, category: "Transport" });

    const res = await request(app).get("/api/expenses/summary").set(bearer(token));
    expect(res.body.grandTotal).toBe(600);
    expect(res.body.byCategory[0]).toMatchObject({ _id: "Food", total: 500, count: 2 });
  });

  test("groups the trend by day for short ranges", async () => {
    const token = await signup();
    await addExpense(token, { amount: 100, date: "2026-10-05" });
    await addExpense(token, { amount: 150, date: "2026-10-05" });
    await addExpense(token, { amount: 50, date: "2026-10-07" });

    const res = await request(app).get("/api/expenses/trend?from=2026-10-01&to=2026-10-31").set(bearer(token));
    expect(res.body.granularity).toBe("day");
    expect(res.body.points).toEqual([
      { period: "2026-10-05", total: 250 },
      { period: "2026-10-07", total: 50 },
    ]);
  });

  test("rejects a date that doesn't exist", async () => {
    const token = await signup();
    const res = await addExpense(token, { date: "2026-02-30" });
    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toEqual({ field: "date", message: "Date does not exist" });
  });

  test("rejects an amount sent as text", async () => {
    const token = await signup();
    const res = await addExpense(token, { amount: "lots" });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("amount");
  });

  test("rejects a malformed expense id", async () => {
    const token = await signup();
    const res = await request(app).delete("/api/expenses/123").set(bearer(token));
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("id");
  });

  test("rejects a date range where from is after to", async () => {
    const token = await signup();
    const res = await request(app).get("/api/expenses/summary?from=2026-10-31&to=2026-10-01").set(bearer(token));
    expect(res.status).toBe(400);
  });

  test("ignores a user field sent in the body (mass assignment)", async () => {
    const token = await signup();
    // Try to create an expense owned by some other user id
    await addExpense(token, { user: "6718a9c2f1d2e3a4b5c6d7e8" });

    const res = await request(app).get("/api/expenses").set(bearer(token));
    expect(res.body.data).toHaveLength(1); // still belongs to the logged-in user
  });
});

// ---------- budget ----------
describe("Monthly budget", () => {
  test("starts with no budget set", async () => {
    const token = await signup();
    const res = await request(app).get("/api/budget").set(bearer(token));
    expect(res.body).toMatchObject({ budget: 0, overBudget: false });
  });

  test("flags overspending this month", async () => {
    const token = await signup();
    await request(app).put("/api/budget").set(bearer(token)).send({ monthlyBudget: 1000 }).expect(200);
    await addExpense(token, { amount: 1500 }); // defaults to today

    const res = await request(app).get("/api/budget").set(bearer(token));
    expect(res.body).toMatchObject({ budget: 1000, spent: 1500, remaining: -500, percentUsed: 150, overBudget: true });
  });

  test("rejects a negative budget", async () => {
    const token = await signup();
    const res = await request(app).put("/api/budget").set(bearer(token)).send({ monthlyBudget: -5 });
    expect(res.status).toBe(400);
  });
});

// ---------- CSV export ----------
describe("CSV export", () => {
  test("exports expenses as CSV, escaping commas and formulas", async () => {
    const token = await signup();
    await addExpense(token, { title: "Pizza, drinks", amount: 450, date: "2026-10-05" });
    await addExpense(token, { title: "=HYPERLINK(evil)", amount: 10, date: "2026-10-06" });

    const res = await request(app).get("/api/expenses/export").set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);

    const lines = res.text.trim().split("\n");
    expect(lines).toEqual([
      "Date,Title,Category,Amount",
      '2026-10-05,"Pizza, drinks",Food,450',
      "2026-10-06,'=HYPERLINK(evil),Food,10",
    ]);
  });
});

// ---------- pagination ----------
describe("Pagination", () => {
  async function addMany(token, count) {
    for (let i = 1; i <= count; i++) {
      const day = String(i).padStart(2, "0"); // 01, 02, ... 25
      await addExpense(token, { title: `Expense ${i}`, date: `2026-10-${day}` });
    }
  }

  test("returns one page plus pagination info", async () => {
    const token = await signup();
    await addMany(token, 25);

    const res = await request(app).get("/api/expenses?page=1&limit=10").set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.data[0].title).toBe("Expense 25"); // newest first
    expect(res.body.pagination).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });
  });

  test("returns the remaining items on the last page", async () => {
    const token = await signup();
    await addMany(token, 25);

    const res = await request(app).get("/api/expenses?page=3&limit=10").set(bearer(token));
    expect(res.body.data.map((e) => e.title)).toEqual(["Expense 5", "Expense 4", "Expense 3", "Expense 2", "Expense 1"]);
  });

  test("never repeats or skips items when dates are the same", async () => {
    const token = await signup();
    for (let i = 0; i < 7; i++) await addExpense(token, { title: `Same day ${i}`, date: "2026-10-10" });

    const titles = [];
    for (let page = 1; page <= 3; page++) {
      const res = await request(app).get(`/api/expenses?page=${page}&limit=3`).set(bearer(token));
      titles.push(...res.body.data.map((e) => e.title));
    }
    expect(titles).toHaveLength(7);
    expect(new Set(titles).size).toBe(7); // all 7 different = no repeats, no gaps
  });

  test("defaults to page 1 with 20 items", async () => {
    const token = await signup();
    const res = await request(app).get("/api/expenses").set(bearer(token));
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20 });
  });

  test("caps the page size at 100", async () => {
    const token = await signup();
    const res = await request(app).get("/api/expenses?limit=1000").set(bearer(token));
    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toEqual({ field: "limit", message: "Limit cannot exceed 100" });
  });
});

// ---------- indexes ----------
describe("Database indexes", () => {
  test("creates compound indexes for the main query patterns", async () => {
    await Expense.syncIndexes(); // make sure indexes exist (they're dropped with the test database)
    const indexes = await mongoose.connection.collection("expenses").indexes();
    const keys = indexes.map((i) => i.key);

    expect(keys).toContainEqual({ user: 1, date: -1 });
    expect(keys).toContainEqual({ user: 1, category: 1, date: -1 });
  });

  test("the expense list query uses an index, not a full collection scan", async () => {
    await Expense.syncIndexes();
    const token = await signup();
    await addExpense(token);
    const userId = (await Expense.findOne()).user;

    // Ask MongoDB HOW it would run the query, instead of running it
    const result = await Expense.find({ user: userId }).sort({ date: -1 }).explain("queryPlanner");
    const plan = Array.isArray(result) ? result[0] : result;
    const winningPlan = JSON.stringify(plan.queryPlanner.winningPlan);

    expect(winningPlan).toContain("IXSCAN");
    expect(winningPlan).not.toContain("COLLSCAN");
  });
});

// ---------- rate limiting ----------
describe("Rate limiting", () => {
  test("blocks login after too many attempts from one IP", async () => {
    const limitedApp = createApp({ authLimit: 3, apiLimit: 10_000 });
    const attempt = () => request(limitedApp).post("/api/auth/login").send({ email: "x@test.com", password: "guess" });

    // The first 3 attempts reach the login code (wrong password -> 401)
    for (let i = 0; i < 3; i++) {
      expect((await attempt()).status).toBe(401);
    }

    // The 4th is blocked before the login code runs
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many login attempts/i);
    expect(blocked.headers).toHaveProperty("ratelimit"); // tells the client when to retry
  });

  test("limits general API traffic separately from login", async () => {
    const limitedApp = createApp({ authLimit: 10_000, apiLimit: 2 });
    await request(limitedApp).get("/api/expenses");
    await request(limitedApp).get("/api/expenses");

    const res = await request(limitedApp).get("/api/expenses");
    expect(res.status).toBe(429);
  });

  test("never rate limits the health check", async () => {
    const limitedApp = createApp({ authLimit: 1, apiLimit: 1 });
    for (let i = 0; i < 5; i++) {
      expect((await request(limitedApp).get("/api/health")).status).toBe(200);
    }
  });
});