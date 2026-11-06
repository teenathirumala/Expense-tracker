import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

/**
 * Creates a rate limiter: each IP may make at most `limit` requests per `windowMs`.
 *
 * Where the counts are kept:
 * - redisClient given -> in Redis, shared by every server instance (survives restarts)
 * - no redisClient    -> in this server's memory (fine for one server, tests, local dev)
 *
 * `prefix` keeps each limiter's counts separate in Redis, e.g. "rl:auth:" vs "rl:api:".
 */
export function createLimiter({ windowMs, limit, message, redisClient = null, prefix }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,

    store: redisClient
      ? new RedisStore({
          // How the store sends commands to Redis, using our existing ioredis client
          sendCommand: (command, ...args) => redisClient.call(command, ...args),
          prefix,
        })
      : undefined, // undefined = express-rate-limit's built-in memory store

    // If Redis is down, let requests through instead of failing every request with an error.
    passOnStoreError: true,

    handler: (req, res) => res.status(429).json({ message, requestId: req.id }),
  });
}