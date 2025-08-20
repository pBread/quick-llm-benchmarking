import { faker } from "@faker-js/faker";
import "dotenv/config";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/index.mjs";
import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses.mjs";
import ss from "simple-statistics";

const benchmarks: Benchmark[] = [
  {
    id: "openai-completions-gpt-4.1",
    fn: composeOpenAICompletions({ model: "gpt-4.1" }),
  },
  {
    id: "openai-completions-gpt-4.1-mini",
    fn: composeOpenAICompletions({ model: "gpt-4.1-mini" }),
  },
  {
    id: "openai-completions-gpt-4.1-nano",
    fn: composeOpenAICompletions({ model: "gpt-4.1-nano" }),
  },
];

class Recorder {
  constructor(public prompt: string) {}

  beginAt?: Date;
  endAt?: Date;
  tokens: TokenItem[] = [];

  firstTokenAt?: Date;
  lastTokenAt?: Date;

  get ttft() {
    return this.firstTokenAt.getTime() - this.beginAt.getTime();
  }
  get tt_complete() {
    return this.lastTokenAt.getTime() - this.beginAt.getTime();
  }

  begin = () => {
    this.beginAt = new Date();
  };
  end = () => {
    this.endAt = new Date();
    this.lastTokenAt = this.tokens[this.tokens.length - 1].createdAt;
  };

  addToken = (token: string | undefined | null) => {
    if (!token) return;

    if (!this.firstTokenAt) this.firstTokenAt = new Date();
    this.tokens.push({ content: token, createdAt: new Date() });
  };
}

async function main() {
  const run: Map<string, Set<Recorder>> = new Map();

  const prompts = Array.from({ length: 3 }).map(makePrompt);

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
}

main();

function makePrompt() {
  return `Can ${faker.animal.type()} eat ${faker.food.adjective()} ${faker.food.vegetable()}?`;
}

// ========================================
// Aggregations
// ========================================

// ========================================
// Types
// ========================================

interface Benchmark {
  id: string;
  fn: Executor;
}

type Executor = (rec: Recorder, prompt: string) => Promise<void>;

interface TokenItem {
  content: string;
  createdAt: Date;
}

// ========================================
// Composers
// ========================================
function composeOpenAICompletions(
  config: Omit<ChatCompletionCreateParamsStreaming, "messages" | "stream">,
): Executor {
  const openAICompletions: Executor = async (rec, prompt) => {
    const client = new OpenAI();

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
  const openAIResponse: Executor = async (rec, prompt) => {
    const client = new OpenAI();

    const stream = await client.responses.create({
      ...config,
      stream: true,
      input: [{ role: "user", content: prompt }],
    });

    for await (const chunk of stream) {
      if (
        chunk.type === "response.output_item.added" &&
        chunk.item.type === "message"
      ) {
        chunk.item.content
          .filter((content) => content.type === "output_text") // filter refusals
          .forEach((content) => rec.addToken(content.text));
      }

      if (chunk.type === "response.output_text.delta")
        rec.addToken(chunk.delta);
    }
  };

  return openAIResponse;
}
