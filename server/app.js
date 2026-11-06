import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import expenseRoutes from "./routes/expenses.js";
import budgetRoutes from "./routes/budget.js";
import { createLimiter } from "./middleware/rateLimit.js";
import { requestLogger } from "./middleware/requestLogger.js";
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./docs/openapi.js";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

//Builds the Express app.
// It's a function (a "factory") so tests can build apps with their own settings,e.g. a tiny login limit to test the 429 response, or a huge one so the normal tests (which sign up many users) never get blocked.
//index.js (the real server) uses the defaults, or the values from .env.

export function createApp({
  authLimit = Number(process.env.AUTH_RATE_LIMIT) || 10, // login/register attempts per IP per 15 min
  apiLimit = Number(process.env.API_RATE_LIMIT) || 300, // all other API requests per IP per 15 min
  redisClient = null, // when given, rate-limit counts are shared across servers via Redis
} = {}) {
  const app = express();

  // Render sits behind a proxy, so every request looks like it comes from the proxy's IP.
  // Trusting one proxy "hop" makes Express read the user's real IP from the
  // X-Forwarded-For header, so each user gets their own rate limit.
  app.set("trust proxy", 1);

  // FIRST: give every request an ID and log it, so even failures below are traceable.
  app.use(requestLogger);

  // exposedHeaders lets the frontend's JavaScript read X-Request-Id (browsers hide it otherwise)
  app.use(cors({ origin: process.env.CLIENT_URL || "*", exposedHeaders: ["X-Request-Id"] }));
  app.use(express.json({ limit: "100kb" })); // reject huge bodies

  // Health check: also reports whether the database is reachable.
  // 503 = "I'm running but can't do my job", which tells Render/Kubernetes not to send traffic.
  // Comes BEFORE the limiters, so monitoring is never blocked.
  app.get("/api/health", (req, res) => {
    const dbUp = mongoose.connection.readyState === 1; // 1 = connected
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? "ok" : "degraded", db: dbUp ? "up" : "down" });
  });

    // API docs: the raw OpenAPI spec as JSON, and the interactive Swagger UI page.
  // Above the rate limiters, so reading the docs never uses up anyone's limit.
  app.get("/api/openapi.json", (req, res) => res.json(openapiSpec));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: "Expense Tracker API" }));


  // Strict limit on login/register to slow down password guessing.
  app.use(
    "/api/auth",
    createLimiter({ windowMs: FIFTEEN_MINUTES, limit: authLimit, message: "Too many login attempts. Try again in 15 minutes.", redisClient,
      prefix: "rl:auth:",})
  );
  // General limit on the whole API, so one client can't flood the server.
  app.use("/api", createLimiter({ windowMs: FIFTEEN_MINUTES, limit: apiLimit, message: "Too many requests. Please slow down.", redisClient,
      prefix: "rl:api:", }));

  app.use("/api/auth", authRoutes);
  app.use("/api/expenses", expenseRoutes);
  app.use("/api/budget", budgetRoutes);

  // Any /api URL that didn't match a route above: JSON 404 instead of Express's HTML page.
  app.use("/api", (req, res) => res.status(404).json({ message: "Route not found", requestId: req.id }));

  // Central error handler (4 arguments = Express knows it's for errors).
  // Known problems become clean 4xx responses. Anything unexpected becomes a 500 with a generic message: the real details are logged, never sent to the user,
  // because they can reveal how the app works inside.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    let status = err.status || err.statusCode || 500;
    let message = err.message;

    if (err.type === "entity.parse.failed") {
      status = 400;
      message = "Request body is not valid JSON";
    } else if (err.type === "entity.too.large") {
      status = 413;
      message = "Request body is too large";
    } else if (err.code === 11000) {
      // MongoDB "duplicate key": two people registered the same email at the same moment
      status = 409;
      message = "Email already registered";
    }

    if (status >= 500) {
      req.log.error({ err }, "unhandled error"); // full details, tagged with the request ID
      message = "Something went wrong. Please try again.";
    }

    res.status(status).json({ message, requestId: req.id });
  });

  return app;
}

// The real server's app, with the default limits.
// export default createApp();