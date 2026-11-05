import { Router } from "express";
import auth from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import Expense from "../models/Expense.js";
import { buildExpenseFilter } from "../utils/filters.js";
import { toCsv } from "../utils/csv.js";
import { expenseBody, idParams, rangeQuery, filterQuery, listQuery } from "../validation/schemas.js";
const router = Router();
router.use(auth);

// GET /api/expenses?from&to&category&page=1&limit=20  ->  { data, pagination }
router.get("/", validate({ query: listQuery }), async (req, res, next) => {
  try {
    const { page, limit, ...filters } = req.valid.query;
    const filter = buildExpenseFilter(req.userId, filters);

    // Run the page query and the total count at the same time.
    // _id is a tie-breaker: expenses with the same date always keep the same order,
    // so an item can never appear on two pages or be skipped.
    const [data, total] = await Promise.all([
      Expense.find(filter)
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Expense.countDocuments(filter),
    ]);

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/expenses/summary?from&to -> totals per category (MongoDB aggregation)
router.get("/summary", validate({ query: rangeQuery }), async (req, res, next) => {
  try {
    const summary = await Expense.aggregate([
      { $match: buildExpenseFilter(req.userId, req.valid.query) },
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
router.get("/trend", validate({ query: rangeQuery }), async (req, res, next) => {
  try {
    const filter = buildExpenseFilter(req.userId, req.valid.query);
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
router.get("/export", validate({ query: filterQuery }), async (req, res, next) => {
  try {
    const expenses = await Expense.find(buildExpenseFilter(req.userId, req.valid.query)).sort({ date: 1 });
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

// POST /api/expenses
router.post("/", validate({ body: expenseBody }), async (req, res, next) => {
  try {
    // The owner always comes from the token, never from the request body.
    const expense = await Expense.create({ ...req.valid.body, user: req.userId });
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
});

// PUT /api/expenses/:id
router.put("/:id", validate({ params: idParams, body: expenseBody }), async (req, res, next) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.valid.params.id, user: req.userId },
      req.valid.body,
      { new: true, runValidators: true }
    );
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    res.json(expense);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/expenses/:id
router.delete("/:id", validate({ params: idParams }), async (req, res, next) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.valid.params.id, user: req.userId });
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;