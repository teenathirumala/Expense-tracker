import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
// Imported after dotenv.config(), so these files see the .env values.
const { createApp } = await import("./app.js");
const { logger } = await import("./logger.js");
const { setRedisClient } = await import("./cache.js");

const PORT = process.env.PORT || 5001;

// 1. Database first: a server that can't reach its database shouldn't start.
try {
  await mongoose.connect(process.env.MONGO_URI);
  logger.info("MongoDB connected");
} catch (err) {
  logger.fatal({ err: err.message }, "MongoDB connection failed");
  process.exit(1);
}

// 2. Redis is optional. If it's configured AND reachable, use it for caching and shared
//    rate limits. If not, the app still runs: no cache, rate limits in memory.
let redisClient = null;
if (process.env.REDIS_URL) {
  const { default: Redis } = await import("ioredis");
  const client = new Redis(process.env.REDIS_URL, {
    lazyConnect: true, // don't connect until we call connect() below
    maxRetriesPerRequest: 1, // fail fast instead of retrying a command many times
    enableOfflineQueue: false, // if Redis is unreachable, fail immediately instead of queueing
  });
  client.on("error", (err) => logger.warn({ err: err.message }, "Redis error"));

  try {
    await client.connect(); // wait until Redis is actually ready
    redisClient = client;
    setRedisClient(client);
    logger.info("Redis connected: caching and shared rate limits enabled");
  } catch (err) {
    logger.warn({ err: err.message }, "Redis unavailable at startup: running without cache, rate limits in memory");
    client.disconnect();
  }
}

// 3. Build the app now that we know whether Redis is available, and start listening.
const app = createApp({ redisClient });
const server = app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

// Graceful shutdown.
// When Render (or Kubernetes) redeploys or stops the app, it sends SIGTERM.
// Instead of dying instantly and cutting off requests mid-way, we:
// 1. stop accepting new connections, 2. let in-flight requests finish,
// 3. close Redis and the database, 4. exit.
async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    if (redisClient) await redisClient.quit();
    await mongoose.disconnect();
    logger.info("Shutdown complete");
    process.exit(0);
  });
  // If something hangs, force-exit after 10 seconds
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM")); // sent by Render / Kubernetes
process.on("SIGINT", () => shutdown("SIGINT")); // sent when you press Ctrl + C