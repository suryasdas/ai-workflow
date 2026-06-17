import { getPool } from "@/lib/db/client";
import { aiAnalysisSchema, createTicketSchema, reviewTicketSchema } from "@/lib/domain/types";
import type { CreateTicketInput, ReviewTicketInput, TicketWithDetails } from "@/lib/domain/types";
import { statusForReviewDecision } from "@/lib/domain/ticket-state";
import { createAiProvider } from "@/lib/ai/provider-factory";
import { AnalysisRepository } from "@/lib/repositories/analysis-repository";
import { ReviewRepository } from "@/lib/repositories/review-repository";
import { TicketRepository } from "@/lib/repositories/ticket-repository";
import { workflowLog } from "@/lib/logger";

export class TicketService {
  private readonly pool = getPool();

  async submitTicket(input: CreateTicketInput) {
    const parsed = createTicketSchema.parse(input);
    const tickets = new TicketRepository(this.pool);

    workflowLog("validated ticket submission", {
      customerEmail: parsed.customerEmail,
      subject: parsed.subject,
    });

    const ticket = await tickets.create(parsed);
    workflowLog("saved ticket", {
      ticketId: ticket.id,
      status: ticket.status,
    });

    await tickets.updateStatus(ticket.id, "processing");
    workflowLog("ticket moved to processing", {
      ticketId: ticket.id,
    });

    await this.processTicket(ticket.id);
    return ticket;
  }

  async processTicket(ticketId: string) {
    const tickets = new TicketRepository(this.pool);
    const analyses = new AnalysisRepository(this.pool);
    const provider = createAiProvider();
    const ticket = await tickets.findById(ticketId);

    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    try {
      workflowLog("starting AI analysis", {
        ticketId,
        subject: ticket.subject,
      });

      const result = await provider.analyzeTicket({ ticket });
      workflowLog("received AI analysis", {
        ticketId,
        provider: result.provider,
        model: result.model,
        category: result.output.category,
        priority: result.output.priority,
        priorityReason: result.output.priorityReason,
        categoryConfidence: result.output.confidence,
        categoryConfidenceReason: result.output.confidenceReason,
      });

      const validatedOutput = aiAnalysisSchema.parse(result.output);
      workflowLog("validated AI output", {
        ticketId,
        category: validatedOutput.category,
        priority: validatedOutput.priority,
        priorityReason: validatedOutput.priorityReason,
        categoryConfidence: validatedOutput.confidence,
        categoryConfidenceReason: validatedOutput.confidenceReason,
      });

      const analysis = await analyses.create({
        ticketId,
        provider: result.provider,
        model: result.model,
        output: validatedOutput,
        rawOutput: result.rawOutput,
      });
      workflowLog("saved AI analysis", {
        analysisId: analysis.id,
        ticketId,
        provider: result.provider,
        model: result.model,
        category: analysis.category,
        priority: analysis.priority,
        categoryConfidence: analysis.confidence,
      });

      await tickets.updateStatus(ticketId, "processed");
      workflowLog("ticket moved to processed", {
        ticketId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI processing error";
      workflowLog("AI analysis failed", {
        ticketId,
        error: message,
      });
      await tickets.updateStatus(ticketId, "failed", message);
      throw error;
    }
  }

  async reviewTicket(input: ReviewTicketInput) {
    const parsed = reviewTicketSchema.parse(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const tickets = new TicketRepository(client);
      const reviews = new ReviewRepository(client);

      const action = await reviews.create(parsed);
      await tickets.updateStatus(parsed.ticketId, statusForReviewDecision(parsed.decision));
      await client.query("COMMIT");
      workflowLog("saved human review", {
        ticketId: parsed.ticketId,
        reviewActionId: action.id,
        reviewerName: action.reviewerName,
        decision: action.decision,
      });
      return action;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listTickets() {
    return new TicketRepository(this.pool).list();
  }

  async getTicketWithDetails(ticketId: string): Promise<TicketWithDetails | null> {
    const tickets = new TicketRepository(this.pool);
    const analyses = new AnalysisRepository(this.pool);
    const reviews = new ReviewRepository(this.pool);
    const ticket = await tickets.findById(ticketId);

    if (!ticket) {
      return null;
    }

    return {
      ticket,
      latestAnalysis: await analyses.findLatestForTicket(ticketId),
      reviewActions: await reviews.listForTicket(ticketId),
    };
  }
}
