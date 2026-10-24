import { Router } from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import Expense from "../models/Expense.js";

const router = Router();
router.use(auth);

// Budget status for the current calendar month (dates are stored as UTC midnight)
async function budgetStatus(userId) {
  const user = await User.findById(userId).select("monthlyBudget");
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [result] = await Expense.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), date: { $gte: start, $lt: end } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const budget = user.monthlyBudget;
  const spent = result?.total || 0;
  return {
    budget,
    spent,
    remaining: budget - spent,
    percentUsed: budget > 0 ? Math.round((spent / budget) * 100) : 0,
    overBudget: budget > 0 && spent > budget,
  };
}

// GET /api/budget
router.get("/", async (req, res, next) => {
  try {
    res.json(await budgetStatus(req.userId));
  } catch (err) {
    next(err);
  }
});

// PUT /api/budget  { monthlyBudget: 15000 }   (0 clears the budget)
router.put("/", async (req, res, next) => {
  try {
    const value = Number(req.body.monthlyBudget);
    if (!Number.isFinite(value) || value < 0) {
      return res.status(400).json({ message: "Budget must be a number of 0 or more" });
    }
    await User.findByIdAndUpdate(req.userId, { monthlyBudget: value });
    res.json(await budgetStatus(req.userId));
  } catch (err) {
    next(err);
  }
});

export default router;
