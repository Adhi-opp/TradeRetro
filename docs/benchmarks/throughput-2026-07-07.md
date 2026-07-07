# Pipeline Throughput Benchmark — 2026-07-07

Producer replicates the real write path (pipelined `XADD` + `HSET` mirror);
the production `pipeline-worker` consumer drains into `bronze.market_ticks`
(batch 200, `executemany`). Ambient simulator traffic (~10 ticks/s) was live.

| Target rate | Achieved | Peak backlog | Drain time | e2e latency (median) | Rows landed |
|---:|---:|---:|---:|---:|---:|
| 100/s | 100/s | 23 | 0.0s | 0.053s | 2,000 |
| 500/s | 500/s | 63 | 0.0s | 0.053s | 10,000 |
| 1,000/s | 1,000/s | 214 | 0.0s | 0.105s | 20,000 |
| 2,500/s | 2,500/s | 2,417 | 0.0s | 0.68s | 50,000 |
| 5,000/s | 5,000/s | 32,308 | 8.79s | 5.041s | 100,000 |
| 10,000/s | 9,999/s | 135,252 | 38.18s | 19.358s | 200,000 |

- **Peak backlog** — max undelivered entries in the consumer group (`XINFO GROUPS` lag).
- **Drain time** — seconds after the producer stopped until backlog reached zero.
- **e2e latency** — probe tick `XADD` → row queryable in bronze.

## Analysis

- **Zero loss at every rate.** Rows landed == ticks produced in all phases; the
  Redis Stream absorbs any burst the consumer can't drain in real time, and
  at-least-once delivery (`XACK` after successful insert) guarantees eventual
  persistence.
- **Real-time up to ~2,500 ticks/s.** Backlog stays trivial and end-to-end
  latency sub-second. NSE production load for the 14 subscribed instruments is
  tens of ticks/second — **two orders of magnitude of headroom**.
- **The single consumer saturates at ≈ 3,450 inserts/s.** Both overload phases
  converge on the same drain-inclusive throughput
  (100,000 / 28.79s ≈ 3,474/s and 200,000 / 58.18s ≈ 3,438/s), identifying the
  `executemany` batch insert as the bottleneck — not Redis (the producer
  sustained 10,000 XADD+HSET pairs/s) and not the network.
- **Scaling paths, in order of effort:** add consumers to the group
  (horizontal, zero code change), raise the read batch above 200, switch the
  insert to binary `COPY`.

Reproduce: `docker compose exec api python benchmarks/benchmark_throughput.py`
(synthetic `BENCH|*` rows are cleaned up on exit).

Raw JSON: same directory, `.json` twin of this file.