import { randomUUID } from "node:crypto";
import pinoHttp from "pino-http";
import { logger } from "../logger.js";

// Only reuse an incoming X-Request-Id if it's short and made of safe characters.
const SAFE_ID = /^[\w-]{1,100}$/;

/**
 * Runs first on every request. It:
 * 1. gives the request an ID (req.id) and returns it in the X-Request-Id response header
 * 2. adds req.log, a logger that automatically includes that ID in every line
 * 3. writes one log line when the response finishes: method, URL, status, how long it took
 */
export const requestLogger = pinoHttp({
  logger,

  genReqId(req, res) {
    // If a load balancer or another service already gave this request an ID, keep it,
    // so one ID can follow the request across services. Otherwise make a new one.
    const incoming = req.headers["x-request-id"];
    const id = typeof incoming === "string" && SAFE_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },

  // 5xx = error, 4xx = warning, everything else = info
  customLogLevel(req, res, err) {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },

  // Log only what's useful, and never headers (they contain the login token)
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },

  // Health checks run every few seconds in production and would flood the logs
  autoLogging: { ignore: (req) => req.url === "/api/health" },
});