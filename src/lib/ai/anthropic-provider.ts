import { aiAnalysisSchema } from "@/lib/domain/types";
import { workflowLog } from "@/lib/logger";
import { parseJsonFromClaudeText } from "./anthropic-parser";
import type { AiProviderResult, AiSupportProvider } from "./types";

type AnthropicMessageResponse = {
  id: string;
  model: string;
  content: Array<{
    type: string;
    text?: string;
  }>;
};

const categories = [
  "damaged_item",
  "refund_request",
  "shipping_issue",
  "account_issue",
  "technical_issue",
  "other",
] as const;

const requiredShape = {
  category: "one of the provided categories",
  sentiment: "short string",
  priority: "integer from 1 to 5",
  priorityReason: "brief explanation for why the ticket deserves that priority",
  confidence: "number from 0 to 1 representing confidence in the selected primary category",
  confidenceReason: "brief explanation for why the primary category assignment is certain or ambiguous",
  summary: "one short paragraph",
  draftReply: "customer-ready support reply",
};

const priorityRubric = {
  1: "Low priority. Informational request or minor inconvenience. The customer can still proceed without significant impact.",
  2: "Moderate-low priority. The issue is real but limited in scope or urgency, and it does not meaningfully block important work.",
  3: "Moderate priority. The issue needs support attention soon and creates meaningful friction, but it is not severe or business-critical.",
  4: "High priority. The customer is blocked, there is financial impact, repeated failure, or same-day urgency that deserves fast handling.",
  5: "Critical priority. Severe customer harm, security risk, major business interruption, or an issue requiring immediate escalation.",
} as const;

export class AnthropicSupportProvider implements AiSupportProvider {
  private readonly model = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6";
  private readonly apiKey = process.env.ANTHROPIC_API_KEY;

  async analyzeTicket({ ticket }: Parameters<AiSupportProvider["analyzeTicket"]>[0]): Promise<AiProviderResult> {
    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required for ticket analysis.");
    }

    const startedAt = Date.now();
    workflowLog("calling Anthropic Messages API", {
      ticketId: ticket.id,
      model: this.model,
    });

    const analysisPayload = {
      categories,
      requiredShape,
      priorityRubric,
      ticket: {
        id: ticket.id,
        customerEmail: ticket.customerEmail,
        subject: ticket.subject,
        body: ticket.body,
        status: ticket.status,
      },
    };

    workflowLog("AI analysis input prepared", {
      ticketId: ticket.id,
      categories,
      requiredShape,
      priorityRubric,
      subject: ticket.subject,
      bodyCharacterCount: ticket.body.length,
      body: ticket.body,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1000,
        system:
          "You classify customer support tickets and draft concise, empathetic replies. Return a raw JSON object only. Do not wrap it in Markdown, code fences, or explanatory text. The JSON object must contain category, sentiment, priority, priorityReason, confidence, confidenceReason, summary, and draftReply. Follow the provided priorityRubric strictly when assigning priority. priorityReason must explicitly justify the numeric priority using the rubric and the ticket text. confidence must represent confidence in the selected primary category assignment, not confidence in the whole ticket or the draft reply. confidenceReason should explain category ambiguity or certainty grounded in the ticket text.",
        messages: [
          {
            role: "user",
            content: JSON.stringify(analysisPayload),
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      workflowLog("Anthropic API returned an error", {
        ticketId: ticket.id,
        status: response.status,
        elapsedMs: Date.now() - startedAt,
      });
      throw new Error(`Anthropic API request failed: ${response.status} ${detail}`);
    }

    const rawOutput = (await response.json()) as AnthropicMessageResponse;
    const text = rawOutput.content.find((item) => item.type === "text")?.text ?? "{}";
    workflowLog("Anthropic raw analysis text", {
      ticketId: ticket.id,
      text,
    });

    workflowLog("parsing Anthropic analysis JSON", {
      ticketId: ticket.id,
      textStartsWith: text.trim().slice(0, 12),
      textCharacterCount: text.length,
    });

    const output = aiAnalysisSchema.parse(parseJsonFromClaudeText(text));

    workflowLog("Anthropic response parsed", {
      ticketId: ticket.id,
      responseId: rawOutput.id,
      model: rawOutput.model,
      elapsedMs: Date.now() - startedAt,
    });

    workflowLog("validated analysis fields", {
      ticketId: ticket.id,
      category: output.category,
      sentiment: output.sentiment,
      priority: output.priority,
      priorityReason: output.priorityReason,
      categoryConfidence: output.confidence,
      categoryConfidenceReason: output.confidenceReason,
      summary: output.summary,
      draftReply: output.draftReply,
    });

    return {
      provider: "anthropic",
      model: rawOutput.model || this.model,
      output,
      rawOutput,
    };
  }
}
