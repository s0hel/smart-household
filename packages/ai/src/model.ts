import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type AiProvider = "ollama" | "anthropic" | "openai";

const DEFAULT_MODEL: Record<AiProvider, string> = {
  ollama: "llama3.2",
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o-mini",
};

/**
 * Resolves the chat model from env vars so the rest of the app never
 * references a specific vendor SDK. AI_PROVIDER picks the backend (defaults
 * to local Ollama for dev); swapping to Anthropic/OpenAI later is just an
 * env change, not a code change, since every provider here speaks the same
 * AI SDK `LanguageModel` interface.
 */
export function getModel(): LanguageModel {
  const provider = (process.env.AI_PROVIDER as AiProvider | undefined) ?? "ollama";
  const modelId = process.env.AI_MODEL ?? DEFAULT_MODEL[provider];

  switch (provider) {
    case "ollama": {
      // Ollama's OpenAI-compatible endpoint means no dedicated provider
      // package is needed — same createOpenAICompatible works for any
      // self-hosted OpenAI-compatible server (LM Studio, vLLM, etc).
      const ollama = createOpenAICompatible({
        name: "ollama",
        baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
      });
      return ollama(modelId);
    }
    case "anthropic":
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelId);
    case "openai":
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(modelId);
    default:
      throw new Error(`Unknown AI_PROVIDER: ${provider}`);
  }
}
