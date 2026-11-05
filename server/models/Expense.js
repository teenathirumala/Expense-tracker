import mongoose from "mongoose";

export const CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Other"];

const expenseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, enum: CATEGORIES, default: "Other" },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound indexes, designed around how the app actually queries expenses:
// 1) { user, date }: "this user's expenses, newest first", optionally within a date range.
//    Used by the list, summary, trend, CSV export and budget.
// 2) { user, category, date }: the same, filtered to one category.
// Index 1 also covers queries on { user } alone (the "prefix rule"),so the old single-field index on user is no longer needed.
expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ user: 1, category: 1, date: -1 });

export default mongoose.model("Expense", expenseSchema);