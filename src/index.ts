import { faker } from "@faker-js/faker";
import "dotenv/config";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/index.mjs";
import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses.mjs";

const benchmarks: Benchmark[] = [
  {
    id: "openai-completions-gpt-4",
    fn: composeOpenAICompletions({ model: "gpt-4" }),
  },
  {
    id: "openai-completions-gpt-4-turbo",
    fn: composeOpenAICompletions({ model: "gpt-4-turbo" }),
  },
  {
    id: "openai-response-gpt-4.1",
    fn: composeOpenAICompletions({ model: "gpt-4" }),
  },
  {
    id: "openai-response-gpt-4-turbo",
    fn: composeOpenAIResponse({ model: "gpt-4.1" }),
  },
];

class Recorder {
  constructor(public prompt: string) {}

  beginAt?: Date;
  endAt?: Date;
  firstTokenAt?: Date;
  tokens: TokenItem[] = [];

  get ttft() {
    return this.firstTokenAt.getTime() - this.beginAt.getTime();
  }

  begin = () => {
    this.beginAt = new Date();
  };
  end = () => {
    this.endAt = new Date();
  };

  addToken = (token: string | undefined | null) => {
    if (!token) return;

    if (!this.firstTokenAt) this.firstTokenAt = new Date();
    this.tokens.push({ content: token, createdAt: new Date() });
  };
}

(async () => {
  const results = [];

  const prompts = Array.from({ length: 10 }).map(makePrompt);

  for await (const bm of benchmarks) {
    console.log(`${bm.id} starting`);

    for (const prompt of prompts) {
      const rec = new Recorder(prompt);

      // await bm.fn(rec, rec.prompt);
      results.push(rec);
      // console.log(`${bm.id} end.`.padEnd(50, " ").concat(`ttft: ${rec.ttft}`));
    }
  }

  console.log(JSON.stringify(results, null, 2));
})();

function makePrompt() {
  return `Can ${faker.animal.type()} eat ${faker.food.adjective()} ${faker.food.vegetable()}?`;
}

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
  return async (rec, prompt) => {
    const client = new OpenAI();

    const stream = await client.chat.completions.create({
      ...config,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    });

    rec.begin();

    for await (const chunk of stream) {
      rec.addToken(chunk.choices[0]?.delta?.content);
    }

    rec.end();
  };
}

function composeOpenAIResponse(
  config: Omit<ResponseCreateParamsStreaming, "messages" | "stream">,
): Executor {
  return async (rec, prompt) => {
    const client = new OpenAI();

    rec.begin();
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

    rec.end();
  };
}
