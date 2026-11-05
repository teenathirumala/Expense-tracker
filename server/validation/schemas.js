import { z } from "zod";
import { CATEGORIES } from "../models/Expense.js";

// ---------- shared building blocks ----------

// Shared email rule: must be a string, trimmed, valid, stored lower-case.
const email = z
  .string({ required_error: "Email is required", invalid_type_error: "Email must be text" })
  .trim()
  .email("Enter a valid email address")
  .toLowerCase();

// "YYYY-MM-DD" -> a Date at midnight UTC.
// The refine step rejects dates that don't exist, like 2026-02-30,
// which new Date() would otherwise silently turn into March 2.
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = z
  .string({ invalid_type_error: "Date must be text in YYYY-MM-DD format" })
  .regex(DATE_FORMAT, "Date must be in YYYY-MM-DD format")
  .refine((s) => {
    if (!DATE_FORMAT.test(s)) return true; // wrong format is already reported above
    const d = new Date(s);
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }, "Date does not exist")
  .transform((s) => new Date(s));

const category = z.enum(CATEGORIES, {
  errorMap: () => ({ message: `Category must be one of: ${CATEGORIES.join(", ")}` }),
});

const money = (label) =>
  z
    .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
    .nonnegative(`${label} cannot be negative`)
    .max(1_000_000_000, `${label} is too large`);

// "from" must not be after "to" (same day is fine)
const fromBeforeTo = (q) => !q.from || !q.to || q.from <= q.to;
const fromBeforeToError = { message: '"from" must be on or before "to"', path: ["from"] };

// ---------- auth ----------

export const registerBody = z.object({
  name: z
    .string({ required_error: "Name is required", invalid_type_error: "Name must be text" })
    .trim()
    .min(1, "Name is required")
    .max(50, "Name must be 50 characters or less"),
  email,
  password: z
    .string({ required_error: "Password is required", invalid_type_error: "Password must be text" })
    .min(6, "Password must be at least 6 characters"),
});

export const loginBody = z.object({
  email,
  password: z
    .string({ required_error: "Password is required", invalid_type_error: "Password must be text" })
    .min(1, "Password is required"),
});

// ---------- expenses ----------

// Body for POST /api/expenses and PUT /api/expenses/:id
export const expenseBody = z.object({
  title: z
    .string({ required_error: "Title is required", invalid_type_error: "Title must be text" })
    .trim()
    .min(1, "Title is required")
    .max(100, "Title must be 100 characters or less"),
  amount: money("Amount"),
  category: category.default("Other"),
  date: isoDate.optional(), // if missing, the model's default (now) is used
});

// URL param for PUT/DELETE /api/expenses/:id — must look like a MongoDB ObjectId
export const idParams = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid expense id"),
});

// Query for summary and trend: ?from&to
// Query for summary and trend: ?from&to
export const rangeQuery = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .refine(fromBeforeTo, fromBeforeToError);

// Filter fields shared by the CSV export and the paginated list
const filterFields = {
  from: isoDate.optional(),
  to: isoDate.optional(),
  category: category.optional(),
};

// Query for the CSV export: ?from&to&category (all matching rows, no pages)
export const filterQuery = z.object(filterFields).refine(fromBeforeTo, fromBeforeToError);

// Query for the list: ?from&to&category&page=1&limit=20
// Query values always arrive as text ("2"), so z.coerce turns them into numbers first.
export const listQuery = z
  .object({
    ...filterFields,
    page: z.coerce
      .number({ invalid_type_error: "Page must be a number" })
      .int("Page must be a whole number")
      .min(1, "Page must be 1 or more")
      .default(1),
    limit: z.coerce
      .number({ invalid_type_error: "Limit must be a number" })
      .int("Limit must be a whole number")
      .min(1, "Limit must be 1 or more")
      .max(100, "Limit cannot exceed 100")
      .default(20),
  })
  .refine(fromBeforeTo, fromBeforeToError);
// ---------- budget ----------

export const budgetBody = z.object({
  monthlyBudget: money("Budget"),
});