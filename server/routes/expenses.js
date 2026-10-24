import { Router } from "express";
import auth from "../middleware/auth.js";
import Expense from "../models/Expense.js";
import { buildExpenseFilter } from "../utils/filters.js";
import { toCsv } from "../utils/csv.js";

const router = Router();
router.use(auth);

// GET /api/expenses?from=2026-10-01&to=2026-10-31&category=Food
router.get("/", async (req, res, next) => {
  try {
    const expenses = await Expense.find(buildExpenseFilter(req)).sort({ date: -1, createdAt: -1 });
    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

// GET /api/expenses/summary?from&to -> totals per category (MongoDB aggregation)
router.get("/summary", async (req, res, next) => {
  try {
    const summary = await Expense.aggregate([
      { $match: buildExpenseFilter(req, { includeCategory: false }) },
      { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    const grandTotal = summary.reduce((s, c) => s + c.total, 0);
    res.json({ grandTotal, byCategory: summary });
  } catch (err) {
    next(err);
  }
});

// GET /api/expenses/trend?from&to -> spending per day (ranges up to ~2 months) or per month
router.get("/trend", async (req, res, next) => {
  try {
    const filter = buildExpenseFilter(req, { includeCategory: false });
    const { $gte: start, $lt: end } = filter.date || {};
    const days = start && end ? (end - start) / 86_400_000 : Infinity;
    const granularity = days <= 62 ? "day" : "month";

    const points = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: granularity === "day" ? "%Y-%m-%d" : "%Y-%m", date: "$date" } },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json({ granularity, points: points.map((p) => ({ period: p._id, total: p.total })) });
  } catch (err) {
    next(err);
  }
});

// GET /api/expenses/export?from&to&category -> downloadable CSV
router.get("/export", async (req, res, next) => {
  try {
    const expenses = await Expense.find(buildExpenseFilter(req)).sort({ date: 1 });
    const csv = toCsv(
      ["Date", "Title", "Category", "Amount"],
      expenses.map((e) => [e.date.toISOString().slice(0, 10), e.title, e.category, e.amount])
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="expenses.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { title, amount, category, date } = req.body;
    if (!title || amount === undefined || amount === "") {
      return res.status(400).json({ message: "Title and amount are required" });
    }
    const expense = await Expense.create({ user: req.userId, title, amount, category, date });
    res.status(201).json(expense);
  } catch (err) {
    if (err.name === "ValidationError" || err.name === "CastError") err.status = 400;
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { title, amount, category, date } = req.body;
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { title, amount, category, date },
      { new: true, runValidators: true }
    );
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    res.json(expense);
  } catch (err) {
    if (err.name === "ValidationError" || err.name === "CastError") err.status = 400;
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    if (err.name === "CastError") err.status = 400;
    next(err);
  }
});

export default router;
