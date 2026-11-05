import { CATEGORIES } from "../models/Expense.js";

// OpenAPI 3 description of the API. Served as JSON at /api/openapi.json and as an
// interactive Swagger UI at /api/docs (click "Authorize", paste a token, try requests).

const dateParam = (name, description) => ({
  name, in: "query", required: false, description,
  schema: { type: "string", format: "date", example: "2026-10-01" },
});
const fromParam = dateParam("from", "Start date (inclusive), YYYY-MM-DD");
const toParam = dateParam("to", "End date (inclusive), YYYY-MM-DD");
const categoryParam = { name: "category", in: "query", required: false, schema: { $ref: "#/components/schemas/Category" } };
const idParam = { name: "id", in: "path", required: true, schema: { type: "string", example: "6718a9c2f1d2e3a4b5c6d7e8" } };

const json = (schema) => ({ content: { "application/json": { schema } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const err = (description) => ({ description, ...json(ref("Error")) });

const R400 = { description: "Validation failed", ...json(ref("ValidationError")) };
const R401 = err("Missing or invalid token");
const R404 = err("Expense not found");
const R429 = err("Too many requests — slow down");

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Expense Tracker API",
    version: "1.2.0",
    description:
      "REST API for a personal expense tracker: JWT auth, expenses CRUD with pagination, " +
      "category/trend analytics, monthly budgets and CSV export.\n\n" +
      "**To try protected endpoints:** call `POST /api/auth/login` (or register), copy the `token`, " +
      "click **Authorize** and paste it.",
  },
  servers: [{ url: "/" }],
  tags: [{ name: "Auth" }, { name: "Expenses" }, { name: "Analytics" }, { name: "Budget" }, { name: "System" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Category: { type: "string", enum: CATEGORIES },
      User: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" }, email: { type: "string", format: "email" } },
      },
      AuthResponse: {
        type: "object",
        properties: { token: { type: "string" }, user: ref("User") },
      },
      ExpenseInput: {
        type: "object",
        required: ["title", "amount"],
        properties: {
          title: { type: "string", maxLength: 100, example: "Groceries" },
          amount: { type: "number", minimum: 0, example: 850 },
          category: { allOf: [ref("Category")], default: "Other" },
          date: { type: "string", format: "date", example: "2026-10-24", description: "Defaults to now" },
        },
      },
      Expense: {
        type: "object",
        properties: {
          _id: { type: "string" },
          user: { type: "string" },
          title: { type: "string" },
          amount: { type: "number" },
          category: ref("Category"),
          date: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 20 },
          total: { type: "integer", example: 57 },
          totalPages: { type: "integer", example: 3 },
        },
      },
      BudgetStatus: {
        type: "object",
        properties: {
          budget: { type: "number", example: 15000 },
          spent: { type: "number", example: 12400 },
          remaining: { type: "number", example: 2600 },
          percentUsed: { type: "integer", example: 83 },
          overBudget: { type: "boolean", example: false },
        },
      },
      Error: {
        type: "object",
        properties: { message: { type: "string" }, requestId: { type: "string" } },
      },
      ValidationError: {
        type: "object",
        properties: {
          message: { type: "string", example: "Validation failed" },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: { field: { type: "string", example: "amount" }, message: { type: "string", example: "Amount cannot be negative" } },
            },
          },
          requestId: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Health check (used by Render / Kubernetes probes)",
        responses: {
          200: { description: "Server and database are up", ...json({ type: "object", properties: { status: { type: "string" }, db: { type: "string" } } }) },
          503: { description: "Database is unreachable" },
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Create an account",
        requestBody: {
          required: true,
          ...json({
            type: "object",
            required: ["name", "email", "password"],
            properties: {
              name: { type: "string", example: "Asha" },
              email: { type: "string", format: "email", example: "asha@example.com" },
              password: { type: "string", minLength: 6, example: "secret123" },
            },
          }),
        },
        responses: { 201: { description: "Created", ...json(ref("AuthResponse")) }, 400: R400, 409: err("Email already registered"), 429: R429 },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in and get a JWT",
        requestBody: {
          required: true,
          ...json({
            type: "object",
            required: ["email", "password"],
            properties: { email: { type: "string", format: "email" }, password: { type: "string" } },
          }),
        },
        responses: { 200: { description: "OK", ...json(ref("AuthResponse")) }, 400: R400, 401: err("Invalid email or password"), 429: R429 },
      },
    },
    "/api/expenses": {
      get: {
        tags: ["Expenses"],
        summary: "List expenses (paginated, newest first)",
        security: [{ bearerAuth: [] }],
        parameters: [
          fromParam, toParam, categoryParam,
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          200: {
            description: "OK",
            ...json({ type: "object", properties: { data: { type: "array", items: ref("Expense") }, pagination: ref("Pagination") } }),
          },
          400: R400, 401: R401, 429: R429,
        },
      },
      post: {
        tags: ["Expenses"],
        summary: "Add an expense",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, ...json(ref("ExpenseInput")) },
        responses: { 201: { description: "Created", ...json(ref("Expense")) }, 400: R400, 401: R401, 429: R429 },
      },
    },
    "/api/expenses/{id}": {
      put: {
        tags: ["Expenses"],
        summary: "Update an expense",
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        requestBody: { required: true, ...json(ref("ExpenseInput")) },
        responses: { 200: { description: "Updated", ...json(ref("Expense")) }, 400: R400, 401: R401, 404: R404, 429: R429 },
      },
      delete: {
        tags: ["Expenses"],
        summary: "Delete an expense",
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: { 200: { description: "Deleted" }, 400: R400, 401: R401, 404: R404, 429: R429 },
      },
    },
    "/api/expenses/summary": {
      get: {
        tags: ["Analytics"],
        summary: "Totals per category",
        security: [{ bearerAuth: [] }],
        parameters: [fromParam, toParam],
        responses: {
          200: {
            description: "OK",
            ...json({
              type: "object",
              properties: {
                grandTotal: { type: "number" },
                byCategory: {
                  type: "array",
                  items: { type: "object", properties: { _id: ref("Category"), total: { type: "number" }, count: { type: "integer" } } },
                },
              },
            }),
          },
          400: R400, 401: R401,
        },
      },
    },
    "/api/expenses/trend": {
      get: {
        tags: ["Analytics"],
        summary: "Spending over time (daily for ranges up to ~2 months, otherwise monthly)",
        security: [{ bearerAuth: [] }],
        parameters: [fromParam, toParam],
        responses: {
          200: {
            description: "OK",
            ...json({
              type: "object",
              properties: {
                granularity: { type: "string", enum: ["day", "month"] },
                points: { type: "array", items: { type: "object", properties: { period: { type: "string" }, total: { type: "number" } } } },
              },
            }),
          },
          400: R400, 401: R401,
        },
      },
    },
    "/api/expenses/export": {
      get: {
        tags: ["Expenses"],
        summary: "Download matching expenses as CSV",
        security: [{ bearerAuth: [] }],
        parameters: [fromParam, toParam, categoryParam],
        responses: {
          200: { description: "CSV file", content: { "text/csv": { schema: { type: "string" } } } },
          400: R400, 401: R401,
        },
      },
    },
    "/api/budget": {
      get: {
        tags: ["Budget"],
        summary: "Budget status for the current month",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "OK", ...json(ref("BudgetStatus")) }, 401: R401 },
      },
      put: {
        tags: ["Budget"],
        summary: "Set the monthly budget (0 clears it)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          ...json({ type: "object", required: ["monthlyBudget"], properties: { monthlyBudget: { type: "number", minimum: 0, example: 15000 } } }),
        },
        responses: { 200: { description: "OK", ...json(ref("BudgetStatus")) }, 400: R400, 401: R401 },
      },
    },
  },
};