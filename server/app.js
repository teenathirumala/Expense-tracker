import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import expenseRoutes from "./routes/expenses.js";
import budgetRoutes from "./routes/budget.js";
import { createLimiter } from "./middleware/rateLimit.js";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Builds the Express app.
 *
 * It's a function (a "factory") so tests can build apps with their own settings,
 * e.g. a tiny login limit to test the 429 response, or a huge one so the normal
 * tests (which sign up many users) never get blocked.
 *
 * index.js (the real server) uses the defaults, or the values from .env.
 */
export function createApp({
  authLimit = Number(process.env.AUTH_RATE_LIMIT) || 10, // login/register attempts per IP per 15 min
  apiLimit = Number(process.env.API_RATE_LIMIT) || 300, // all other API requests per IP per 15 min
} = {}) {
  const app = express();

  // Render sits behind a proxy, so every request looks like it comes from the proxy's IP.
  // Trusting one proxy "hop" makes Express read the user's real IP from the
  // X-Forwarded-For header, so each user gets their own rate limit.
  app.set("trust proxy", 1);

  app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
  app.use(express.json());

  // Health check comes BEFORE the limiters, so monitoring is never blocked.
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // Strict limit on login/register to slow down password guessing.
  app.use(
    "/api/auth",
    createLimiter({ windowMs: FIFTEEN_MINUTES, limit: authLimit, message: "Too many login attempts. Try again in 15 minutes." })
  );
  // General limit on the whole API, so one client can't flood the server.
  app.use("/api", createLimiter({ windowMs: FIFTEEN_MINUTES, limit: apiLimit, message: "Too many requests. Please slow down." }));

  app.use("/api/auth", authRoutes);
  app.use("/api/expenses", expenseRoutes);
  app.use("/api/budget", budgetRoutes);

  // Central error handler
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ message: err.message || "Server error" });
  });

  return app;
}

// The real server's app, with the default limits.
export default createApp();