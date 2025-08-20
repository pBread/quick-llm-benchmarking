import "dotenv/config";
import kebabCase from "lodash/kebabCase.js";
import OpenAI from "openai";
import prompts from "./prompts.js";

const { OPENAI_API_KEY } = process.env;

class Run {
  constructor(id) {}
}

async function execute() {
  const result = await run();

  console.log("result", result);
}

async function run() {
  const runId = kebabCase(new Date().toISOString());

  const benchmarks = [];
  for (const prompt of prompts) {
    const bm = await oaiChatCompletions(makeBenchmark({ runId, prompt }));
    benchmarks.push(bm);
  }

  return benchmarks;
}

async function oaiChatCompletions(bm) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const stream = await client.chat.completions.create({
    stream: true,
    model: "gpt-4",
    messages: [{ role: "user", content: bm.prompt }],
  });

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (choice.delta.content) bm.content += choice.delta.content;
  }

  bm.done = true;

  return bm;
}

execute();

// ========================================
// Creators
// ========================================
function makeBenchmark({ prompt, runId }) {
  const start = new Date();

  let content = "";
  let tsFirstToken = undefined;

  let done = false;
  let tsDone = undefined;

  return {
    prompt,
    runId,
    start,

    get content() {
      return content;
    },
    set content(val) {
      if (!content) tsFirstToken = new Date();
      content = val;
    },

    get done() {
      return done;
    },
    set done(val) {
      if (!done && val && !tsDone) tsDone = new Date();
      done = val;
    },
  };
}
