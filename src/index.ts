import { faker } from "@faker-js/faker";
import "dotenv/config";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/index.mjs";
import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses.mjs";
import * as ss from "simple-statistics";
import { table } from "table";
import { Agent, fetch as undiciFetch } from "undici";
import ping from "ping";

const ITERATIONS = 5;
const WARMUP = true;

const benchmarks: Benchmark[] = [
  // {
  //   id: "gpt-4.1-completions",
  //   fn: composeOpenAICompletions({ model: "gpt-4.1" }),
  //   host: "api.openai.com",
  // },

  {
    id: "gpt-4.1-mini-completions",
    fn: composeOpenAICompletions({ model: "gpt-4.1-mini" }),
    host: "api.openai.com",
  },
  {
    id: "gpt-4o-mini-completions",
    fn: composeOpenAICompletions({ model: "gpt-4o-mini" }),
    host: "api.openai.com",
  },
  {
    id: "gpt-3.5-turbo-completions",
    fn: composeOpenAICompletions({ model: "gpt-3.5-turbo" }),
    host: "api.openai.com",
  },
];

const now = () => performance.now();

class Recorder {
  constructor(public bm: Benchmark, public prompt: string) {}

  startTime: Date;

  beginAt?: number;
  endAt?: number;
  tokens: TokenItem[] = [];

  firstTokenAt?: number;
  lastTokenAt?: number;

  get ttft() {
    return this.ttft_w_network && this.ttft_w_network - this.pingMs;
  }

  get ttft_w_network() {
    return this.firstTokenAt && this.beginAt
      ? this.firstTokenAt - this.beginAt - this.pingMs
      : NaN;
  }
  get tt_complete() {
    return this.lastTokenAt && this.beginAt
      ? this.lastTokenAt - this.beginAt
      : NaN;
  }

  pingMs = 0;
  doPing = async () => {
    try {
      const res = await ping.promise.probe(this.bm.host, { timeout: 5 });
      if (res.alive && res.time !== "unknown") this.pingMs = res.time;
    } catch (error) {}

    if (!this.pingMs)
      console.warn(
        `ping failed on (${this.bm.host}). network latency will be included in benchmark`,
      );

    return this.pingMs;
  };

  begin = () => {
    this.beginAt = now();
    this.startTime = new Date();
  };
  end = () => {
    this.endAt = now();
    if (!this.tokens.length) return;
    this.lastTokenAt = this.tokens[this.tokens.length - 1].createdAt;
  };

  addToken = (token: string | undefined | null) => {
    if (!token) return;

    if (!this.firstTokenAt) this.firstTokenAt = now();
    this.tokens.push({ content: token, createdAt: now() });
  };
}

async function main() {
  const run: RunMap = new Map();

  const prompts = Array.from({ length: ITERATIONS }).map(makePrompt);

  for (const bm of benchmarks) run.set(bm.id, new Set());

  const logInterval = setInterval(() => {
    console.clear();
    printSummary(run);
  }, 1000);

  for await (const bm of benchmarks) {
    console.log(`starting ${bm.id}`);

    if (WARMUP) {
      console.log(`warmup started`);
      const rec = new Recorder(bm, "Tell me a joke");
      await bm.fn(rec);
      console.log(`warmup complete`);
    }

    for await (const prompt of prompts) {
      const rec = new Recorder(bm, prompt);
      rec.begin();
      await Promise.all([bm.fn(rec), rec.doPing()]);
      rec.end();

      run.get(bm.id).add(rec);
    }
  }
  clearInterval(logInterval);
  printSummary(run);
}

main();

function makePrompt() {
  return `Can ${faker.animal.type()} eat ${faker.food.adjective()} ${faker.food.vegetable()}?`;
}

// ========================================
// Aggregations
// ========================================
function printSummary(run: RunMap) {
  const rows = Array.from(run).map((entry) => aggregate(entry[0], entry[1]));
  const summaryData = [
    [
      "Benchmark",
      "Count",
      "Mean",
      "SD",

      "Min",
      "p25",
      "Median",
      "p75",
      "p95",
      "p99",
      "Max",
    ],
    ...rows.map((r) => [
      r.benchmark,
      r.count,
      fmt(r.ttft_mean_ms),
      fmt(r.ttft_sd_ms),

      fmt(r.ttft_pct.p0),
      fmt(r.ttft_pct.p25),
      fmt(r.ttft_pct.p50),
      fmt(r.ttft_pct.p75),
      fmt(r.ttft_pct.p95),
      fmt(r.ttft_pct.p99),
      fmt(r.ttft_pct.p100),
    ]),
  ];

  const output = table(summaryData);
  console.log(output);
}

function aggregate(benchmarkId: string, recorders: Set<Recorder>) {
  const ttfts = Array.from(recorders)
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

function round(x: number) {
  return Number.isFinite(x) ? Math.round(x) : NaN;
}

function fmt(x: number, digits = 1) {
  return Number.isFinite(x) ? x.toFixed(digits) : NaN;
}

function percentiles(xs: number[], probs: number[]) {
  if (!xs.length) return {};
  const s = [...xs].sort((a, b) => a - b);
  return Object.fromEntries(
    probs.map((p) => [`p${p * 100}`, ss.quantileSorted(s, p)]),
  );
}

// ========================================
// Types
// ========================================
type RunMap = Map<string, Set<Recorder>>;

interface Benchmark {
  id: string;
  fn: Executor;
  host: string; // api host to remove local network latency
}

type Executor = (rec: Recorder) => Promise<void>;

interface TokenItem {
  content: string;
  createdAt: number;
}

// ========================================
// Composers
// ========================================
function composeOpenAICompletions(
  config: Omit<ChatCompletionCreateParamsStreaming, "messages" | "stream">,
): Executor {
  const client = makeOpenAIClient();

  const openAICompletions: Executor = async (rec) => {
    const stream = await client.chat.completions.create({
      ...config,
      stream: true,
      messages: [{ role: "user", content: rec.prompt }],
    });

    for await (const chunk of stream) {
      rec.addToken(chunk.choices[0]?.delta?.content);
    }
  };

  return openAICompletions;
}

function composeOpenAIResponse(
  config: Omit<ResponseCreateParamsStreaming, "messages" | "stream">,
): Executor {
  const client = makeOpenAIClient();

  const openAIResponse: Executor = async (rec) => {
    const stream = await client.responses.create({
      ...config,
      stream: true,
      input: [{ role: "user", content: rec.prompt }],
    });

    for await (const chunk of stream) {
      if (chunk.type === "response.output_text.delta")
        rec.addToken(chunk.delta);
    }
  };

  return openAIResponse;
}

function makeOpenAIClient() {
  const dispatcher = new Agent({
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 30_000,
  });
  const typedFetch: typeof fetch = undiciFetch as unknown as typeof fetch;

  const client = new OpenAI({
    maxRetries: 0,
    fetch: (url, opts) => typedFetch(url, { ...opts, dispatcher }),
  });

  return client;
}

async function pingHost(host: string) {
  try {
    const res = await ping.promise.probe(host, { timeout: 5 });
    if (res.alive && res.time !== "unknown") return res.time;
    console.warn(
      `host (${host}) did not respond to ping. network latency will be included in benchmark`,
    );

    return 0;
  } catch (error) {
    console.error("Ping failed:", error);
  }
}

// ========================================
// Printing
// ========================================
