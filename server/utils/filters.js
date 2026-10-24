import mongoose from "mongoose";
import { CATEGORIES } from "../models/Expense.js";

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function parseDate(value, name) {
  const date = new Date(value);
  if (typeof value !== "string" || isNaN(date)) throw badRequest(`Invalid "${name}" date`);
  return date;
}

/**
 * Builds a MongoDB filter from ?from=YYYY-MM-DD&to=YYYY-MM-DD&category=Food.
 * Dates are stored as UTC midnight, and "to" is inclusive (whole day).
 */
export function buildExpenseFilter(req, { includeCategory = true } = {}) {
  const filter = { user: new mongoose.Types.ObjectId(req.userId) };
  const { category, from, to } = req.query;

  if (includeCategory && category) {
    // Only accept known string values — blocks NoSQL operator injection like ?category[$ne]=x
    if (typeof category !== "string" || !CATEGORIES.includes(category)) throw badRequest("Invalid category");
    filter.category = category;
  }

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = parseDate(from, "from");
    if (to) {
      const end = parseDate(to, "to");
      end.setUTCDate(end.getUTCDate() + 1);
      filter.date.$lt = end;
    }
    if (from && to && filter.date.$gte >= filter.date.$lt) throw badRequest('"from" must be before "to"');
  }

  return filter;
}
