import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";

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
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ title: "Groceries", amount: 850, category: "Food" });
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
    expect(list.body).toHaveLength(0);
  });

  test("users cannot see or delete each other's expenses", async () => {
    const alice = await signup("alice@test.com");
    const bob = await signup("bob@test.com");
    const { body: aliceExpense } = await addExpense(alice);

    const bobList = await request(app).get("/api/expenses").set(bearer(bob));
    expect(bobList.body).toHaveLength(0);

    const bobDelete = await request(app).delete(`/api/expenses/${aliceExpense._id}`).set(bearer(bob));
    expect(bobDelete.status).toBe(404);
  });

  test("filters by date range (end date inclusive)", async () => {
    const token = await signup();
    await addExpense(token, { title: "September rent", date: "2026-09-30" });
    await addExpense(token, { title: "October rent", date: "2026-10-31" });

    const res = await request(app).get("/api/expenses?from=2026-10-01&to=2026-10-31").set(bearer(token));
    expect(res.body.map((e) => e.title)).toEqual(["October rent"]);
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
