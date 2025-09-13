import * as ss from "simple-statistics";
import { table } from "table";
import type { RunMap } from "./types.ts";
import { Recorder } from "./recorder.ts";

export function printSummary(run: RunMap) {
  const rows = Array.from(run).map((entry) => aggregate(entry[0], entry[1]));
  const summaryData = [
    [
      "Benchmark",
      "Count",
      // "Mean",
      // "SD",

      "Min",
      "p25",
      green("Median"),
      "p75",
      "p95",
      "p99",
      "Max",
    ],
    ...rows
      .sort((a, b) => a.ttft_pct.p50 - b.ttft_pct.p50)
      .map((r) => [
        r.benchmark,
        r.count,
        // fmt(r.ttft_mean_ms),
        // fmt(r.ttft_sd_ms),

        fmt(r.ttft_pct.p0),
        fmt(r.ttft_pct.p25),
        green(fmt(r.ttft_pct.p50)),
        fmt(r.ttft_pct.p75),
        fmt(r.ttft_pct.p95),
        fmt(r.ttft_pct.p99),
        fmt(r.ttft_pct.p100),
      ]),
  ];

  const output = table(summaryData);
  console.log(
    output +
      `\n values represent time-to-first-token (TTFT) in milliseconds\n\n`,
  );
  console.log("  ");
}

function green(str: string) {
  return `\x1b[32m${str}\x1b[0m`;
}

function aggregate(benchmarkId: string, recorders: Set<Recorder>) {
  const ttfts = Array.from(recorders)
    .filter((r) => !r.failed)
    .map((r) => r.ttft)
    .filter((n) => Number.isFinite(n));

  const n = ttfts.length;

  const mean = n ? ss.mean(ttfts) : NaN;
  const sd = n > 1 ? ss.sampleStandardDeviation(ttfts) : NaN;

  return {
    benchmark: benchmarkId,
    count: n,
    ttft_mean_ms: mean,
    ttft_sd_ms: sd,

    ttft_pct: percentiles(ttfts, [0, 0.25, 0.5, 0.75, 0.95, 0.99, 1]),
  };
}

function fmt(x: number, digits = 1) {
  return `${Number.isFinite(x) ? x.toFixed(digits) : NaN}`;
}

function percentiles(xs: number[], probs: number[]) {
  if (!xs.length) return {};
  const s = [...xs].sort((a, b) => a - b);
  return Object.fromEntries(
    probs.map((p) => [`p${p * 100}`, ss.quantileSorted(s, p)]),
  );
}
