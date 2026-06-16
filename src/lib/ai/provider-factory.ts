import type { AiSupportProvider } from "./types";
import { AnthropicSupportProvider } from "./anthropic-provider";

export function createAiProvider(): AiSupportProvider {
  return new AnthropicSupportProvider();
}
