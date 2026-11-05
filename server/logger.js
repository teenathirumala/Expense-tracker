import pino from "pino";

// One shared logger for the whole server.
// pino writes each log as one line of JSON, e.g:- {"level":30,"time":1730793600000,"msg":"MongoDB connected"}
// so log tools can search and filter by field (level, requestId, statusCode...).
export const logger = pino({
  // Silent during tests so Jest's output stays clean; "info" otherwise.
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "test" ? "silent" : "info"),
});