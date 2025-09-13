import "dotenv/config";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/index.mjs";
import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses.mjs";
import { Agent, fetch as undiciFetch } from "undici";
import type { Executor } from "./types.ts";

// ========================================
// Open AI
// ========================================
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

export function composeOpenAICompletions(
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

export function composeOpenAIResponse(
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
