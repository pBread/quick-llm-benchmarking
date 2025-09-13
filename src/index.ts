import "dotenv/config";
import OpenAI from "openai";
import { ChatCompletionCreateParamsStreaming } from "openai/resources";
import PQueue from "p-queue";
import {
  composeOpenAICompletions,
  composeOpenAIResponse,
} from "./composers.ts";
import { printSummary } from "./logging.ts";
import { makePrompt } from "./prompt.ts";
import { Recorder } from "./recorder.ts";
import type { Benchmark, RunMap } from "./types.ts";

const ITERATIONS = 384;
const WARMUP = true;

// these parameters get applied to each queue, which allows you to rate limit for fast benchmarks or spread the benchmark run over an extended period of time
// by default, each benchmark gets its own queue. define a queueKey on the benchmark to share a queue
const INTERVAL = 10 * 1000;

const QUEUE_CONFIG: ConstructorParameters<typeof PQueue>[0] = {
  concurrency: 3,
  interval: INTERVAL,
  intervalCap: 1,
};

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const benchmarks: Benchmark[] = [
  // {
  //   id: "gpt-4.1-mini-completions",
  //   host: "api.openai.com",
  //   fn: async ({ prompt, addToken }) => {
  //     const stream = await client.chat.completions.create({
  //       model: "gpt-4.1-mini",
  //       stream: true,
  //       messages: [{ role: "user", content: prompt }],
  //     });
  //     for await (const chunk of stream) {
  //       addToken(chunk.choices[0]?.delta?.content);
  //     }
  //   },
  // },
];

const params: Omit<
  ChatCompletionCreateParamsStreaming,
  "messages" | "stream"
>[] = [
  { model: "gpt-3.5-turbo" },

  { model: "gpt-4o" },
  { model: "gpt-4o-mini" },

  { model: "gpt-4.1" },
  { model: "gpt-4.1-mini" },
  { model: "gpt-4.1-nano" },
];

for (const param of params)
  benchmarks.push({
    host: "api.openai.com",
    id: `oai-${param.model}-completions-api`,
    fn: composeOpenAICompletions(param),
  });

for (const param of params)
  benchmarks.push({
    host: "api.openai.com",
    id: `oai-${param.model}-response-api`,
    fn: composeOpenAIResponse({ model: param.model }),
  });

console.log("benchmarks", benchmarks);

main();

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
  }, 1000);

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

    await new Promise(
      (resolve) =>
        setTimeout(() => resolve(null), INTERVAL / benchmarks.length), // space out the benchmarks to maximize distribution over time
    );
  }

  await Promise.allSettled(scheduled);

  clearInterval(logInterval);
  console.clear();
  printSummary(run);
}
