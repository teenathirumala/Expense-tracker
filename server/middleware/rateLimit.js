import rateLimit from "express-rate-limit";


// Creates a rate limiter: each IP address may make at most `limit` requests per `windowMs` milliseconds. Over the limit, the request gets 429 Too Many Requests and never reaches the route.
//Note: counts are kept in this server's memory. If you ran several copies of the server, each would keep its own count, so you'd move the store to Redis to share one count across all of them.

export function createLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7", // send a RateLimit header: how many requests are left, and when it resets
    legacyHeaders: false, // don't also send the older X-RateLimit-* headers
       handler: (req, res) => res.status(429).json({ message, requestId: req.id }),
  });
}