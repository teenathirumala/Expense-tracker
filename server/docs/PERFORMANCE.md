# Performance

## Baseline (before caching)

**Setup:** MacBook Pro, local MongoDB, 1 user with 5,000 expenses over 12 months,
autocannon for 15 s per run. Rate limit raised and logs set to `warn` for the test.

| Endpoint | Connections | Req/sec (avg) | p50 | p97.5 | p99 | Max |
|---|---|---|---|---|---|---|
| `/api/health` | 10 | ~34,850 | 0 ms | 0 ms | 0 ms | 12 ms |
| `/expenses/summary` (1 year) | 10 | ~2,140 | 2 ms | 23 ms | 30 ms | 80 ms |
| `/expenses/trend` (1 year) | 10 | ~1,670 | 3 ms | 33 ms | 41 ms | 90 ms |
| `/expenses?page=1&limit=20` | 10 | ~1,170 | 6 ms | 30 ms | 39 ms | 117 ms |
| `/expenses/summary` (1 year) | 50 | ~2,070 | 11 ms | 143 ms | 164 ms | 345 ms |

**Findings**
- The aggregation dominates: `/health` (no database) handles ~16× more requests than `/summary`.
- `/summary` is saturated at 10 connections: going to 50 gives the same throughput and ~5× the latency (Little's Law).
- The list is the slowest endpoint because each request runs both `find` and `countDocuments`, and returns larger JSON.
- Against MongoDB Atlas's free tier, throughput was capped at ~100 req/s by its 100 operations/second limit,
  with throttling causing multi-second tail latency and timeouts.

**How to reproduce:** `MONGO_URI=<local loadtest URI> node scripts/seed.js`, start the server with the same
`MONGO_URI` plus `API_RATE_LIMIT=1000000 LOG_LEVEL=warn`, log in as `loadtest@example.com`, then run autocannon.