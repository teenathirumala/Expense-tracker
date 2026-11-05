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
  //Builds a MongoDB filter from query values that validate() has ALREADY checked.
  //  - from , to are Date objects (midnight UTC); "to" is inclusive, so we match everything before midnight of the following day.
  //  - category is already one of the allowed categories.
export function buildExpenseFilter(userId, { from, to, category } = {}) {
  const filter = { user: new mongoose.Types.ObjectId(userId) };

  if (category) filter.category = category;

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) {
      const end = new Date(to); // copy, so we don't change the validated value
      end.setUTCDate(end.getUTCDate() + 1);
      filter.date.$lt = end;
    }
  }

  return filter;
}
