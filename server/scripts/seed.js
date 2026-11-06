//Fills a SEPARATE load-test database with one user and lots of expenses,so load tests measure realistic work.
//Run:
//   MONGO_URI="<your URI with database name expense-tracker-loadtest>" node scripts/seed.js

import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Expense, { CATEGORIES } from "../models/Expense.js";

dotenv.config(); // never overwrites a MONGO_URI i typed on the command line

const EMAIL = "loadtest@example.com";
const PASSWORD = "loadtest123";
const COUNT = Number(process.env.SEED_COUNT) || 5000;
const DAY_MS = 86_400_000; //Milliseconds in one day: 24 × 60 × 60 × 1000

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// A random calendar day in the last 365 days, stored at midnight UTC
// (the same way the app stores dates the user picks).
function randomDate() {
  const d = new Date(Date.now() - randomInt(0, 364) * DAY_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

await mongoose.connect(process.env.MONGO_URI);

// 1. Safety: refuse to touch anything except the load-test database.
const dbName = mongoose.connection.name;
if (!dbName.includes("loadtest")) {
  console.error(`Refusing to seed database "${dbName}". Use a URI whose database name includes "loadtest".`);
  await mongoose.disconnect();
  process.exit(1);
}

// 2. Start fresh: remove the old load-test user and their expenses.
const existing = await User.findOne({ email: EMAIL });
if (existing) {
  await Expense.deleteMany({ user: existing._id });
  await User.deleteOne({ _id: existing._id });
}

// 3. Create the user (password hashed, exactly like /register does).
const user = await User.create({
  name: "Load Test",
  email: EMAIL,
  password: await bcrypt.hash(PASSWORD, 10),
  monthlyBudget: 50000,
});

// 4. Build all the expenses in memory first...
const expenses = Array.from({ length: COUNT }, (_, i) => ({
  user: user._id,
  title: `Expense ${i + 1}`,
  amount: randomInt(10, 5000),
  category: randomItem(CATEGORIES),
  date: randomDate(),
}));

// 5. ...then insert them in ONE database call.
const start = Date.now();
await Expense.insertMany(expenses);
console.log(`Seeded "${dbName}": 1 user (${EMAIL} / ${PASSWORD}) and ${COUNT} expenses in ${Date.now() - start} ms`);

await mongoose.disconnect();