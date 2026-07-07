# Design Decisions

Architecture Decision Records for TradeRetro. Each entry states the decision,
the alternatives that were actually on the table, and the trade-offs accepted.
These map directly onto the design chapter of the capstone report.

**Global constraints that shaped everything below:**

- Solo developer; every extra moving part is a maintenance tax paid by one person.
- Single host: 16 GB Windows laptop running Docker Desktop (~1.4 GB RAM budget
  for the whole stack). No cloud spend.
- The host is not always on — the design must tolerate being switched off
  mid-week and heal itself on restart.
- Real NSE market data (Upstox V3 free API) with a simulator fallback so
  development never blocks on market hours or credentials.

---

## ADR-001 — Redis Streams over Kafka for tick ingestion

**Decision:** Broker the live tick feed through a Redis Stream
(`market:ticks`) with a consumer group, not Kafka.

**Alternatives:** Kafka (+ ZooKeeper/KRaft), RabbitMQ, direct WebSocket→DB
writes with no broker.

**Why:**

- The problem needs a durable, replayable, ordered log with consumer-group
  semantics — Redis Streams provides exactly that feature subset
  (`XADD`/`XREADGROUP`/`XACK`, at-least-once, pending-entries list) in a
  single ~30 MB container.
- Kafka's advantages (partitioned horizontal scale, multi-TB retention,
  cross-team topics) solve problems this system does not have: one producer,
  one consumer group, ~500k entries of buffer. On a 16 GB laptop, a broker
  JVM would be the single largest process in the stack.
- Redis was already required for O(1) latest-quote lookups (`market:latest`
  hash), so the broker adds zero new infrastructure.
- No broker at all was rejected because the WebSocket producer and the DB
  writer must fail independently — the benchmark's overload phases demonstrate
  why: the stream absorbs bursts the writer can't drain, with zero loss.

**Trade-offs accepted:** Stream capped at 500k entries (`MAXLEN ~`), so an
outage longer than the buffer loses raw ticks — mitigated by the
reconciliation DAG (ADR-010). Redis persistence is best-effort (no fsync per
entry); acceptable because bronze is rebuildable from the Upstox REST API.

**Evidence:** benchmark sustained 10,000 XADD+HSET/s on the producer side —
Redis is not the bottleneck at 100× expected load
([benchmarks](benchmarks/throughput-2026-07-07.md)).

---

## ADR-002 — TimescaleDB over ClickHouse / InfluxDB / vanilla PostgreSQL

**Decision:** One TimescaleDB (PostgreSQL 16 + extension) instance is the
entire warehouse — bronze ticks, silver/gold OHLCV, EOD history, and the ops
control plane.

**Alternatives:** ClickHouse, InfluxDB, vanilla PostgreSQL, DuckDB+Parquet.

**Why:**

- The workload is time-series *plus* relational: hypertables for ticks and
  bars, but also `ops.data_catalog` watermarks, ingestion audit logs, and
  user universe tables with joins and upserts. TimescaleDB gives both in one
  engine with full SQL; ClickHouse/InfluxDB would force a second store (or
  painful workarounds) for the relational half.
- Continuous aggregates give the silver→gold rollups (5-min, daily)
  *inside the database* — no scheduler code to write, no drift between the
  rollup and the source.
- Native retention policies auto-drop bronze chunks older than 30 days —
  storage stays bounded on a laptop disk with zero cron jobs.
- One database = one backup, one connection pool, one set of credentials,
  one migration chain. Solo-dev tax matters.

**Trade-offs accepted:** ClickHouse would out-scan TimescaleDB on multi-billion
row analytics; at this project's scale (hundreds of thousands of rows/day,
~40k EOD rows) the row-store never comes close to its limits — the measured
bottleneck is insert throughput (~3,450 rows/s single consumer), which is a
consumer-side ceiling, not a storage one.

---

## ADR-003 — Watermark-driven incremental loads over log-based CDC

**Decision:** EOD ingestion is incremental via a per-ticker
`ops.data_catalog.high_watermark`; each run fetches only bars newer than the
watermark and advances it transactionally.

**Alternatives:** Log-based CDC (Debezium), full refresh on every run, event
sourcing from the provider.

**Why:**

- CDC captures changes in *a database you own upstream*. Here the upstream is
  a third-party HTTP API (yfinance) — there is no WAL to tail. The watermark
  pattern is the correct incremental primitive for pull-based APIs.
- Full refresh (~10 years × 16 tickers daily) would hammer a free API and burn
  quota for data that never changes; the watermark reduces the steady-state
  daily load to one bar per ticker.
- The watermark also powers the self-healing startup catch-up (ADR-005): one
  code path serves scheduled runs, catch-up runs, and manual backfills, because
  every run is just "fetch from watermark to now, idempotently upsert".

**Trade-offs accepted:** Restated history (splits, dividend adjustments) behind
the watermark is not re-fetched automatically; the manual backfill flow
(`POST /api/ingest/backfill`) covers that case on demand.

---

## ADR-004 — Prefect 3 over Airflow for orchestration

**Decision:** Pipelines are Prefect `@flow`/`@task` functions; the Prefect
server container provides run history and the DAG UI.

**Alternatives:** Airflow, Dagster, cron + plain scripts.

**Why:**

- Airflow wants a scheduler, webserver, metadata DB, and executor — a
  multi-container commitment that would roughly double the stack's footprint
  to run *three* DAGs. Prefect's decorator model adds orchestration semantics
  (retries, observability, parametrized runs) to what are already plain async
  Python functions.
- Flows remain importable and unit-testable without any server — the test
  suite stubs Prefect and calls the underlying functions directly; CI needs
  no orchestrator.
- Cron + scripts was rejected because run history, failure visibility, and
  parametrized manual triggers (the `/api/ingest/*` endpoints) are core
  deliverables for a data-engineering project, not nice-to-haves.

**Trade-offs accepted:** Prefect 3's deployment/work-pool model is overkill for
a single host, so it is deliberately *not* used — flows are invoked in-process
(ADR-005). The Prefect server is therefore pure observability; if it is down,
pipelines still run.

---

## ADR-005 — In-process scheduler with startup catch-up, not a worker pool

**Decision:** A ~100-line asyncio task inside the FastAPI lifespan schedules
the EOD flow (Mon–Fri 16:00 IST). On startup it compares the warehouse
watermark against the last expected trading day and immediately runs a
catch-up if slots were missed.

**Alternatives:** Prefect deployments + worker pool, host cron, Windows Task
Scheduler.

**Why:**

- A separate worker container costs RAM and adds a deploy artifact to keep in
  sync, to gain parallelism this workload doesn't need (one flow, once a day).
- Host-level cron/Task Scheduler moves pipeline logic outside the versioned,
  containerized stack — invisible to anyone who clones the repo.
- The catch-up check exists because of a *measured failure*: the fixed-time
  slot only fires while the container is running, and on a sometimes-off
  laptop the warehouse was observed 36 days stale. Because ingestion is
  watermark-driven and idempotent (ADR-003), one catch-up run heals an
  arbitrary outage.

**Trade-offs accepted:** The scheduler dies with the API container (acceptable:
so does everything else on a single host); multi-replica deployments would
double-fire (guarded by the `DISABLE_EOD_SCHEDULER` flag).

---

## ADR-006 — Medallion architecture with idempotency enforced at silver

**Decision:** bronze (append-only raw ticks) → silver (1-min OHLCV, upserted
on `(instrument_key, bucket)`) → gold (continuous aggregates). Correctness is
enforced at silver, not bronze.

**Why:**

- Raw ticks have no natural dedup key (two identical ticks are legitimate), so
  bronze *cannot* be idempotent — it is an append-only log, exactly like the
  medallion pattern intends. At-least-once redelivery may double-insert a
  tick.
- Silver re-aggregates a rolling 5-minute window every 60 s with
  `ON CONFLICT ... DO UPDATE` on the bar's primary key: deterministic input →
  deterministic bar, so duplicates in bronze are absorbed and re-processing is
  safe. This converts "exactly-once delivery" (hard) into "idempotent
  processing" (tractable) — the standard streaming trade
  (ADR-007).
- Gold is TimescaleDB-managed (ADR-002): the 5-min and daily rollups cannot
  drift from silver because the database owns the refresh.

---

## ADR-007 — At-least-once delivery, not exactly-once

**Decision:** The consumer `XACK`s only after a successful batch insert;
failures leave messages pending for redelivery. No dedup at bronze.

**Why:** Exactly-once end-to-end requires either distributed transactions
across Redis and PostgreSQL or transactional outbox machinery — infrastructure
whose failure modes are harder to reason about than the problem it solves
here. Downstream idempotency (ADR-006) makes duplicates harmless, so
at-least-once is *sufficient for correctness* at the layer users query.
The benchmark's overload phases confirm the property: 200,000/200,000 ticks
landed at 10,000/s with the consumer saturated.

---

## ADR-008 — Single async FastAPI process with a shared asyncpg pool

**Decision:** One Uvicorn process; a single asyncpg pool created in the
lifespan and shared by all routers; the EOD scheduler and (in the worker
container) producer/consumer/aggregator run as asyncio tasks.

**Why:** The workload is I/O-bound (DB, Redis, HTTP) — async concurrency
covers it without worker processes. A per-request connection would pay
connection setup on every call and exhaust PostgreSQL under polling UIs; the
pool amortizes it. CPU-heavy paths (backtest, WFA) are vectorized
pandas/numpy (ADR-011), which release enough of the GIL via C internals to
keep latency acceptable at this scale.

---

## ADR-009 — Two data planes: yfinance EOD + Upstox live, unified at serve time

**Decision:** Historical/EOD data comes from yfinance in bulk; live intraday
comes from the Upstox V3 WebSocket; `/api/live/*` resolves Redis-first with
EOD fallback and labels every quote with `source` and staleness.

**Why:**

- Upstox does not serve deep history on the free tier; yfinance does not
  serve live ticks. Each source covers the other's gap.
- Serving-time resolution (fresh tick < 60 s old wins, else latest EOD close
  flagged with `stale_days`) means the frontend never has to know which plane
  a number came from — but the user can always see it (`source: "upstox" |
  "eod"`), which is a data-lineage requirement, not cosmetics.
- The simulator producer keeps the entire live plane exercisable offline —
  same stream, same consumer, same schemas — so development and CI never
  depend on market hours, credentials, or connectivity.

---

## ADR-010 — Self-healing reconciliation instead of "more reliable" ingestion

**Decision:** A reconciler loop (live mode, every 3 min during market hours)
detects missing 1-min silver buckets and patches them from the Upstox
intraday-candle REST API, tagging rows `source='reconciled'`.

**Why:** WebSocket disconnects are a *when*, not an *if* — hardening the
producer can shrink the gap but never close it (the laptop can sleep
mid-session). Detect-and-repair against an authoritative replay source is
strictly stronger than prevention. `ON CONFLICT DO NOTHING` guarantees real
streamed bars are never clobbered, and the per-row `source` tag preserves
lineage so reconciled data is distinguishable forever.

---

## ADR-011 — Vectorized pandas engine; Polars/Numba deliberately deferred

**Decision:** The backtest/WFA/correlation engines are pure pandas/numpy.
No Polars, no Numba, no Rust.

**Why:** Optimization without a measured bottleneck is cargo cult. Current
measurements: a full walk-forward analysis (31 folds, 10 years of daily bars)
completes in ~370 ms; the pipeline's measured ceiling is the DB insert path,
not analytics. If intraday-scale backtesting ever creates a real bottleneck,
the escalation path is ProcessPoolExecutor first (parallel folds), rewrite
last.

---

## ADR-012 — Grafana for infrastructure observability, React for product UI

**Decision:** Pipeline/warehouse telemetry lives in four auto-provisioned
Grafana dashboards (embedded in the app in kiosk mode); the React app owns
only product surfaces (backtesting, cross-asset research, data quality).

**Why:** Rebuilding time-series ops dashboards in React is weeks of work
Grafana ships for free, with provisioning-as-code (`grafana/` directory is
version-controlled JSON/YAML). The split also keeps the DE story honest:
infrastructure health is queried straight from `ops.*` tables and
`timescaledb_information.*`, demonstrating the warehouse is self-describing.
