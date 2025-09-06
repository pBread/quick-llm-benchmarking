import "dotenv/config";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/index.mjs";
import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses.mjs";
import PQueue from "p-queue";
import { Agent, fetch as undiciFetch } from "undici";
import { printSummary } from "./logging.ts";
import { makePrompt } from "./prompt.ts";
import { Recorder } from "./recorder.ts";
import type { Benchmark, Executor, RunMap } from "./types.ts";

const ITERATIONS = 10;
const WARMUP = true;

// these parameters get applied to each queue, which allows you to rate limit for fast benchmarks or spread the benchmark run over an extended period of time
// by default, each benchmark gets its own queue. define a queueKey on the benchmark to share a queue
const QUEUE_CONFIG: ConstructorParameters<typeof PQueue>[0] = {
  concurrency: 1,
};

const benchmarks: Benchmark[] = [
  {
    id: "gpt-4.1-completions",
    fn: composeOpenAICompletions({ model: "gpt-4.1" }),
    host: "api.openai.com",
  },
  {
    id: "gpt-4.1-mini-completions",
    fn: composeOpenAICompletions({ model: "gpt-4.1-mini" }),
    host: "api.openai.com",
  },
  {
    id: "gpt-4.1-nano-completions",
    fn: composeOpenAICompletions({ model: "gpt-4.1-nano" }),
    host: "api.openai.com",
  },
];

async function main() {
  const run: RunMap = new Map();

  const prompts = Array.from({ length: ITERATIONS }).map(makePrompt);

  const queues = new Map<string, PQueue>();
  for (const bm of benchmarks) {
    run.set(bm.id, new Set());
    queues.set(bm.queueKey ?? bm.id, new PQueue(QUEUE_CONFIG));
  }

  const scheduled: Promise<unknown>[] = [];

  const runOne = async (bm: Benchmark, prompt: string) => {
    const rec = new Recorder(bm, prompt);
    rec.begin();
    try {
      await Promise.all([bm.fn(rec), rec.doPing()]);
    } catch (err) {
      rec.setError(err);
    } finally {
      rec.end();
      run.get(bm.id).add(rec);

      console.log(`${bm.id}: ${rec.ttft.toFixed(0)}ms`);
    }
  };

  console.clear();
  printSummary(run);

  const logInterval = setInterval(() => {
    console.clear();
    printSummary(run);
  }, 2000);

  for await (const bm of benchmarks) {
    if (WARMUP) {
      console.log(`${bm.id}: warmup started`);
      const rec = new Recorder(bm, "Tell me a joke");
      await bm.fn(rec);
      console.log(`${bm.id}: warmup complete for benchmark`);
    }
  }

  for await (const bm of benchmarks) {
    console.log(`${bm.id}: scheduling`);
    const q = queues.get(bm.queueKey ?? bm.id)!;

    for (const prompt of prompts) {
      scheduled.push(q.add(() => runOne(bm, prompt)));
    }
  }

  await Promise.allSettled(scheduled);

  clearInterval(logInterval);
  console.clear();
  printSummary(run);
}

main();

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
    try {
      const stream = await client.responses.create({
        ...config,
        stream: true,
        input: [{ role: "user", content: rec.prompt }],
      });

      for await (const chunk of stream) {
        if (chunk.type === "response.output_text.delta")
          rec.addToken(chunk.delta);
      }
    } catch (error) {
      rec.setError(error);
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
