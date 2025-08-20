import { faker } from "@faker-js/faker";
import "dotenv/config";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/index.mjs";
import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses.mjs";
import * as ss from "simple-statistics";
import { table } from "table";
import { Agent, fetch as undiciFetch } from "undici";

const ITERATIONS = 25;

const benchmarks: Benchmark[] = [
  {
    id: "openai-completions-gpt-4.1-mini",
    fn: composeOpenAICompletions({ model: "gpt-4.1-mini" }),
  },

  {
    id: "openai-response-gpt-4.1-mini-keepalive",
    fn: composeOpenAIResponse({ model: "gpt-4.1-mini" }),
  },
];

const now = () => performance.now();

class Recorder {
  constructor(public prompt: string) {}

  startTime: Date;

  beginAt?: number;
  endAt?: number;
  tokens: TokenItem[] = [];

  firstTokenAt?: number;
  lastTokenAt?: number;

  get ttft() {
    return this.firstTokenAt && this.beginAt
      ? this.firstTokenAt - this.beginAt
      : NaN;
  }
  get tt_complete() {
    return this.lastTokenAt && this.beginAt
      ? this.lastTokenAt - this.beginAt
      : NaN;
  }

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

  for await (const prompt of prompts) {
    console.log(prompt);
    for await (const bm of benchmarks) {
      if (!run.has(bm.id)) run.set(bm.id, new Set());

      const rec = new Recorder(prompt);
      rec.begin();
      await bm.fn(rec, rec.prompt);
      rec.end();

      run.get(bm.id).add(rec);
      console.log(`${bm.id} end.`.padEnd(50, " ").concat(`ttft: ${rec.ttft}`));
    }
  }

  const rows = Array.from(run).map((entry) => aggregate(entry[0], entry[1]));
  const data = [
    ["Benchmark", "Count", "Mean (ms)", "Min (ms)", "Max (ms)", "SD (ms)"],
    ...rows.map((r) => [
      r.benchmark,
      r.count,
      r.ttft_mean_ms,
      r.ttft_min_ms,
      r.ttft_max_ms,
      r.ttft_sd_ms,
    ]),
  ];

  console.log("\nTTFT summary (ms) per benchmark");
  const output = table(data);
  console.log(output);
}

main();

function makePrompt() {
  return `Can ${faker.animal.type()} eat ${faker.food.adjective()} ${faker.food.vegetable()}?`;
}

// ========================================
// Aggregations
// ========================================
function aggregate(benchmarkId: string, recorders: Set<Recorder>) {
  const ttfts = Array.from(recorders)
    .map((r) => r.ttft)
    .filter((n) => Number.isFinite(n));

  const n = ttfts.length;

  const mean = n ? ss.mean(ttfts) : NaN;
  const min = n ? ss.min(ttfts) : NaN;
  const max = n ? ss.max(ttfts) : NaN;

  // Sample standard deviation; undefined for n < 2 so guard it.
  const sd = n > 1 ? ss.sampleStandardDeviation(ttfts) : NaN;

  const format = (x: number) => (Number.isFinite(x) ? Math.round(x) : NaN);

  return {
    benchmark: benchmarkId,
    count: n,
    ttft_mean_ms: format(mean),
    ttft_min_ms: format(min),
    ttft_max_ms: format(max),
    ttft_sd_ms: format(sd),
  };
}

// ========================================
// Types
// ========================================
type RunMap = Map<string, Set<Recorder>>;

interface Benchmark {
  id: string;
  fn: Executor;
}

type Executor = (rec: Recorder, prompt: string) => Promise<void>;

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

  const openAICompletions: Executor = async (rec, prompt) => {
    const stream = await client.chat.completions.create({
      ...config,
      stream: true,
      messages: [{ role: "user", content: prompt }],
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

  const openAIResponse: Executor = async (rec, prompt) => {
    const stream = await client.responses.create({
      ...config,
      stream: true,
      input: [{ role: "user", content: prompt }],
    });

    for await (const chunk of stream) {
      if (chunk.type === "response.output_text.delta")
        rec.addToken(chunk.delta);
    }
  };

  return openAIResponse;
}

function makeOpenAIClient() {
  const dispatcher = new Agent();
  const typedFetch: typeof fetch = undiciFetch as unknown as typeof fetch;

  const client = new OpenAI({
    maxRetries: 0,
    fetch: (url, opts) => typedFetch(url, { ...opts, dispatcher }),
  });

  return client;
}
