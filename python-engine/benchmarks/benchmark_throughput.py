"""
Pipeline Throughput Benchmark
=============================
Measures how much tick traffic the live pipeline actually sustains:

    benchmark producer ──XADD──▶ market:ticks ──XREADGROUP──▶ consumer ──▶ bronze

The producer replicates the real write path (pipelined XADD + HSET mirror,
same field schema as pipeline/upstox_ws.py) at escalating target rates and
lets the *real* pipeline-worker consumer drain into TimescaleDB. Per phase:

    achieved rate   XADDs/sec the producer actually sustained
    peak lag        max undelivered backlog (XINFO GROUPS `lag`)
    drain time      seconds after producer stops until backlog hits zero
    e2e latency     median tick→queryable-in-bronze latency (probe ticks)
    bronze rows     rows landed, verified against ticks produced

Synthetic ticks use BENCH|* instrument keys and are deleted from bronze,
silver, and the market:latest hash on exit (skip with --keep).

Usage (stack must be running — the pipeline-worker consumer does the work):
    cd python-engine
    python benchmarks/benchmark_throughput.py
    python benchmarks/benchmark_throughput.py --rates 100 1000 10000 --duration 30
"""

import argparse
import asyncio
import json
import os
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path

import asyncpg
import redis.asyncio as aioredis

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/traderetro_raw"
)

TICK_STREAM = "market:ticks"
LATEST_HASH = "market:latest"
CONSUMER_GROUP = "tick-consumers"
MAX_STREAM_LEN = 500_000

BENCH_PREFIX = "BENCH|"
N_SYMBOLS = 14  # mirror the production subscription size
SLICE_SEC = 0.1  # produce in 100ms slices for rate control
PROBES_PER_PHASE = 3
PROBE_POLL_SEC = 0.05
PROBE_TIMEOUT_SEC = 30.0
DRAIN_TIMEOUT_SEC = 180.0


def _make_tick(symbol_idx: int, ltp: float) -> dict:
    """Same field schema the upstox_ws/simulator producers emit."""
    return {
        "instrument_key": f"{BENCH_PREFIX}SYM{symbol_idx}",
        "symbol": f"BENCHSYM{symbol_idx}",
        "ltp": f"{ltp:.2f}",
        "volume": "100",
        "oi": "0",
        "bid_price": f"{ltp - 0.05:.2f}",
        "ask_price": f"{ltp + 0.05:.2f}",
        "bid_qty": "500",
        "ask_qty": "500",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "benchmark",
    }


async def _group_backlog(r: aioredis.Redis) -> tuple[int, int]:
    """(undelivered lag, delivered-but-unacked pending) for the consumer group."""
    groups = await r.xinfo_groups(TICK_STREAM)
    for g in groups:
        name = g.get("name", b"")
        name = name.decode() if isinstance(name, bytes) else name
        if name == CONSUMER_GROUP:
            return int(g.get("lag") or 0), int(g.get("pending") or 0)
    return 0, 0


async def _produce_slice(r: aioredis.Redis, count: int, base_price: float) -> None:
    """Pipelined XADD + HSET mirror — the real producer's write path."""
    pipe = r.pipeline(transaction=False)
    for i in range(count):
        tick = _make_tick(i % N_SYMBOLS, base_price + (i % 50) * 0.1)
        pipe.xadd(TICK_STREAM, tick, maxlen=MAX_STREAM_LEN, approximate=True)
        pipe.hset(LATEST_HASH, tick["symbol"], json.dumps(tick, separators=(",", ":")))
    await pipe.execute()


async def _probe_latency(r: aioredis.Redis, pool: asyncpg.Pool, tag: str) -> float | None:
    """XADD one uniquely-keyed tick, poll bronze until it lands. Returns seconds."""
    key = f"{BENCH_PREFIX}PROBE-{tag}"
    tick = _make_tick(0, 100.0)
    tick["instrument_key"] = key
    t0 = time.perf_counter()
    await r.xadd(TICK_STREAM, tick, maxlen=MAX_STREAM_LEN, approximate=True)
    deadline = t0 + PROBE_TIMEOUT_SEC
    while time.perf_counter() < deadline:
        found = await pool.fetchval(
            "SELECT 1 FROM bronze.market_ticks WHERE instrument_key = $1 LIMIT 1", key
        )
        if found:
            return time.perf_counter() - t0
        await asyncio.sleep(PROBE_POLL_SEC)
    return None


async def run_phase(
    r: aioredis.Redis, pool: asyncpg.Pool, target_rate: int, duration: int
) -> dict:
    print(f"\n─ phase: {target_rate:,} ticks/sec for {duration}s " + "─" * 30)

    bronze_before = await pool.fetchval(
        "SELECT count(*) FROM bronze.market_ticks WHERE instrument_key LIKE 'BENCH|SYM%'"
    )

    per_slice = max(1, round(target_rate * SLICE_SEC))
    produced = 0
    peak_lag = 0
    peak_pending = 0
    probe_tasks: list[asyncio.Task] = []
    probe_at = {duration * 0.25, duration * 0.5, duration * 0.75}
    probes_fired = 0

    start = time.perf_counter()
    next_slice = start
    last_sample = start

    while (elapsed := time.perf_counter() - start) < duration:
        await _produce_slice(r, per_slice, 100.0)
        produced += per_slice

        now = time.perf_counter()
        if now - last_sample >= 0.5:
            lag, pending = await _group_backlog(r)
            peak_lag = max(peak_lag, lag)
            peak_pending = max(peak_pending, pending)
            last_sample = now

        # Fire probes in the background so polling doesn't stall the producer
        if probes_fired < PROBES_PER_PHASE and any(elapsed >= p for p in probe_at):
            probe_at = {p for p in probe_at if p > elapsed}
            probes_fired += 1
            probe_tasks.append(
                asyncio.create_task(_probe_latency(r, pool, f"{target_rate}-{probes_fired}"))
            )

        next_slice += SLICE_SEC
        sleep_for = next_slice - time.perf_counter()
        if sleep_for > 0:
            await asyncio.sleep(sleep_for)

    produce_wall = time.perf_counter() - start
    achieved_rate = produced / produce_wall

    # Drain: wait until the group has consumed the whole backlog
    drain_start = time.perf_counter()
    drain_time = None
    while time.perf_counter() - drain_start < DRAIN_TIMEOUT_SEC:
        lag, pending = await _group_backlog(r)
        peak_lag = max(peak_lag, lag)
        if lag == 0 and pending == 0:
            drain_time = time.perf_counter() - drain_start
            break
        await asyncio.sleep(0.25)

    bronze_after = await pool.fetchval(
        "SELECT count(*) FROM bronze.market_ticks WHERE instrument_key LIKE 'BENCH|SYM%'"
    )
    landed = bronze_after - bronze_before

    latencies = [lat for lat in await asyncio.gather(*probe_tasks) if lat is not None]

    result = {
        "target_rate": target_rate,
        "duration_sec": duration,
        "produced": produced,
        "achieved_rate": round(achieved_rate, 1),
        "peak_lag": peak_lag,
        "peak_pending": peak_pending,
        "drain_time_sec": round(drain_time, 2) if drain_time is not None else None,
        "e2e_latency_median_sec": (
            round(statistics.median(latencies), 3) if latencies else None
        ),
        "bronze_rows_landed": landed,
    }
    print(
        f"  produced {produced:,} @ {achieved_rate:,.0f}/s · peak lag {peak_lag:,} · "
        f"drain {result['drain_time_sec']}s · e2e median "
        f"{result['e2e_latency_median_sec']}s · landed {landed:,}"
    )
    return result


async def cleanup(r: aioredis.Redis, pool: asyncpg.Pool) -> None:
    print("\ncleaning up synthetic BENCH|* data ...")
    del_bronze = await pool.execute(
        "DELETE FROM bronze.market_ticks WHERE instrument_key LIKE 'BENCH|%'"
    )
    del_silver = await pool.execute(
        "DELETE FROM silver.ohlcv_1min WHERE instrument_key LIKE 'BENCH|%'"
    )
    fields = [f"BENCHSYM{i}" for i in range(N_SYMBOLS)]
    await r.hdel(LATEST_HASH, *fields)
    print(f"  bronze: {del_bronze} · silver: {del_silver} · hash fields: {len(fields)}")


def write_report(results: list[dict], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d")
    md = out_dir / f"throughput-{stamp}.md"

    lines = [
        f"# Pipeline Throughput Benchmark — {stamp}",
        "",
        "Producer replicates the real write path (pipelined `XADD` + `HSET` mirror);",
        "the production `pipeline-worker` consumer drains into `bronze.market_ticks`",
        "(batch 200, `executemany`). Ambient simulator traffic (~10 ticks/s) was live.",
        "",
        "| Target rate | Achieved | Peak backlog | Drain time | e2e latency (median) | Rows landed |",
        "|---:|---:|---:|---:|---:|---:|",
    ]
    for res in results:
        lines.append(
            f"| {res['target_rate']:,}/s | {res['achieved_rate']:,.0f}/s "
            f"| {res['peak_lag']:,} | {res['drain_time_sec']}s "
            f"| {res['e2e_latency_median_sec']}s | {res['bronze_rows_landed']:,} |"
        )
    lines += [
        "",
        "- **Peak backlog** — max undelivered entries in the consumer group (`XINFO GROUPS` lag).",
        "- **Drain time** — seconds after the producer stopped until backlog reached zero.",
        "- **e2e latency** — probe tick `XADD` → row queryable in bronze.",
        "",
        "Raw JSON: same directory, `.json` twin of this file.",
    ]
    md.write_text("\n".join(lines), encoding="utf-8")
    (out_dir / f"throughput-{stamp}.json").write_text(
        json.dumps(results, indent=2), encoding="utf-8"
    )
    return md


async def main() -> None:
    ap = argparse.ArgumentParser(description="TradeRetro pipeline throughput benchmark")
    ap.add_argument("--rates", type=int, nargs="+", default=[100, 500, 1000, 2500, 5000, 10000])
    ap.add_argument("--duration", type=int, default=20, help="seconds per phase")
    ap.add_argument("--keep", action="store_true", help="skip cleanup of BENCH|* rows")
    ap.add_argument("--out", default="../docs/benchmarks", help="report output dir")
    args = ap.parse_args()

    r = aioredis.from_url(REDIS_URL, decode_responses=False)
    await r.ping()
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3)
    print(f"connected · stream={TICK_STREAM} · group={CONSUMER_GROUP}")

    lag, pending = await _group_backlog(r)
    if lag or pending:
        print(f"waiting for existing backlog to clear (lag={lag}, pending={pending}) ...")
        while lag or pending:
            await asyncio.sleep(1)
            lag, pending = await _group_backlog(r)

    results = []
    try:
        for rate in args.rates:
            results.append(await run_phase(r, pool, rate, args.duration))
    finally:
        if not args.keep:
            await cleanup(r, pool)
        if results:
            out = Path(args.out)
            if not out.is_absolute():
                out = Path(__file__).parent / out
            report = write_report(results, out)
            print(f"\nreport written: {report.resolve()}")
        await pool.close()
        await r.aclose()


if __name__ == "__main__":
    asyncio.run(main())
