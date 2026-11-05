import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
// Imported after dotenv.config(), so app.js and logger.js see the .env values.
const { default: app } = await import("./app.js");
const { logger } = await import("./logger.js");

const PORT = process.env.PORT || 5001;

// Connect to the database first; a server that can't reach its database shouldn't start.
try {
  await mongoose.connect(process.env.MONGO_URI);
  logger.info("MongoDB connected");
} catch (err) {
  logger.fatal({ err: err.message }, "MongoDB connection failed");
  process.exit(1);
}

const server = app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

// Graceful shutdown.
// When Render (or Kubernetes) redeploys or stops the app, it sends SIGTERM.
// Instead of dying instantly and cutting off requests mid-way, we:
// 1. stop accepting new connections, 2. let in-flight requests finish,
// 3. close the database connection, 4. exit.
async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await mongoose.disconnect();
    logger.info("Shutdown complete");
    process.exit(0);
  });
  // If something hangs, force-exit after 10 seconds
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM")); // sent by Render / Kubernetes
process.on("SIGINT", () => shutdown("SIGINT")); // sent when you press Ctrl + C