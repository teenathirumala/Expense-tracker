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

- `/summary` is saturated at 10 connections: going to 50 gives the same throughput and ~5× the latency (Little's Law).
- The list is the slowest endpoint because each request runs both `find` and `countDocuments`, and returns larger JSON.
- Against MongoDB Atlas's free tier, throughput was capped at ~100 req/s by its 100 operations/second limit,
  with throttling causing multi-second tail latency and timeouts.

**How to reproduce:** `MONGO_URI=<local loadtest URI> node scripts/seed.js`, start the server with the same
`MONGO_URI` plus `API_RATE_LIMIT=1000000 LOG_LEVEL=warn`, log in as `loadtest@example.com`, then run autocannon.


## After Redis caching (Level 2, Step 2)

Same setup as the baseline, with Redis running locally. Summary and trend use cache-aside:
results are cached per user and date range in a Redis hash, cleared on any expense change, with a 10-minute TTL.

| Endpoint | Conn. | | Req/sec | p50 | p97.5 | p99 | Max |
|---|---|---|---|---|---|---|---|
| `/summary` | 10 | before | 2,137 | 2 ms | 23 ms | 30 ms | 80 ms |
| | | after | 13,292 | 0 ms | 1 ms | 1 ms | 14 ms |
| `/trend` | 10 | before | 1,669 | 3 ms | 33 ms | 41 ms | 90 ms |
| | | after | 13,306 | 0 ms | 1 ms | 1 ms | 46 ms |
| `/summary` | 50 | before | 2,072 | 11 ms | 143 ms | 164 ms | 345 ms |
| | | after | 14,211 | 3 ms | 4 ms | 5 ms | 33 ms |
| `/expenses?page=1&limit=20` (control, not cached) | 10 | before | 1,168 | 6 ms | 30 ms | 39 ms | 117 ms |
| | | after | 1,516 | 6 ms | 10 ms | 22 ms | 56 ms |

**Results:** the analytics endpoints handled ~6–8× more requests per second, and p99 latency
under 50 connections fell from 164 ms to 5 ms.

**Control:** the list endpoint is not cached, yet it ran ~30% faster in the second session, so part of the
difference is the machine (warm MongoDB cache, less background load), not the code.
Adjusting for that, the speed-up from caching alone is roughly **5×**.

**Caveat:** this benchmark has a 100% cache hit rate (one user, one date range, no writes during the run).
Real traffic would see a lower hit rate and a smaller improvement.