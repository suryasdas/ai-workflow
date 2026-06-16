import type { AiAnalysisOutput, Ticket } from "@/lib/domain/types";

export type AiAnalysisRequest = {
  ticket: Ticket;
};

export type AiProviderResult = {
  provider: string;
  model: string;
  output: AiAnalysisOutput;
  rawOutput: unknown;
};

export interface AiSupportProvider {
  analyzeTicket(request: AiAnalysisRequest): Promise<AiProviderResult>;
}
