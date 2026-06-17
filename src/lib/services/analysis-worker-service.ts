import { createAiProvider } from "@/lib/ai/provider-factory";
import { getPool } from "@/lib/db/client";
import { aiAnalysisSchema } from "@/lib/domain/types";
import { workflowLog } from "@/lib/logger";
import { AnalysisJobRepository } from "@/lib/repositories/analysis-job-repository";
import { AnalysisRepository } from "@/lib/repositories/analysis-repository";
import { TicketRepository } from "@/lib/repositories/ticket-repository";

export type ProcessNextJobResult =
  | { outcome: "idle" }
  | { outcome: "processed"; jobId: string; ticketId: string }
  | { outcome: "failed"; jobId: string; ticketId: string; error: string };

export class AnalysisWorkerService {
  private readonly pool = getPool();

  async processNextAvailableJob(): Promise<ProcessNextJobResult> {
    const jobs = new AnalysisJobRepository(this.pool);
    const tickets = new TicketRepository(this.pool);
    const analyses = new AnalysisRepository(this.pool);
    const provider = createAiProvider();

    workflowLog("worker polling for queued analysis jobs");
    const job = await jobs.claimNextAvailable();

    if (!job) {
      workflowLog("worker found no queued analysis jobs");
      return { outcome: "idle" };
    }

    workflowLog("worker claimed queued analysis job", {
      jobId: job.id,
      ticketId: job.ticketId,
      attemptCount: job.attemptCount,
      claimedStatus: job.status,
    });

    const ticket = await tickets.findById(job.ticketId);

    if (!ticket) {
      const error = `Ticket not found for analysis job: ${job.ticketId}`;
      await jobs.markFailed(job.id, error);
      workflowLog("worker failed analysis job before AI execution", {
        jobId: job.id,
        ticketId: job.ticketId,
        error,
      });
      return {
        outcome: "failed",
        jobId: job.id,
        ticketId: job.ticketId,
        error,
      };
    }

    const processingTicket = await tickets.updateStatus(ticket.id, "processing");
    workflowLog("worker moved ticket to processing", {
      jobId: job.id,
      ticketId: ticket.id,
      ticketStatus: processingTicket.status,
    });

    try {
      workflowLog("worker starting AI analysis for claimed job", {
        jobId: job.id,
        ticketId: ticket.id,
        subject: processingTicket.subject,
      });
      const result = await provider.analyzeTicket({ ticket: processingTicket });
      workflowLog("worker received AI analysis", {
        jobId: job.id,
        ticketId: ticket.id,
        provider: result.provider,
        model: result.model,
        category: result.output.category,
        priority: result.output.priority,
      });

      const validatedOutput = aiAnalysisSchema.parse(result.output);
      workflowLog("worker validated AI analysis output", {
        jobId: job.id,
        ticketId: ticket.id,
        category: validatedOutput.category,
        priority: validatedOutput.priority,
        categoryConfidence: validatedOutput.confidence,
      });
      const analysis = await analyses.create({
        ticketId: ticket.id,
        provider: result.provider,
        model: result.model,
        output: validatedOutput,
        rawOutput: result.rawOutput,
      });
      workflowLog("worker saved AI analysis record", {
        jobId: job.id,
        ticketId: ticket.id,
        analysisId: analysis.id,
      });
      const completedJob = await jobs.markCompleted(job.id);
      const processedTicket = await tickets.updateStatus(ticket.id, "processed");

      workflowLog("worker completed analysis job and marked ticket processed", {
        jobId: completedJob.id,
        ticketId: ticket.id,
        analysisId: analysis.id,
        jobStatus: completedJob.status,
        ticketStatus: processedTicket.status,
        category: validatedOutput.category,
        priority: validatedOutput.priority,
      });

      return {
        outcome: "processed",
        jobId: job.id,
        ticketId: ticket.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown worker error";
      const failedJob = await jobs.markFailed(job.id, message);
      const failedTicket = await tickets.updateStatus(ticket.id, "failed", message);
      workflowLog("worker failed analysis job and marked ticket failed", {
        jobId: failedJob.id,
        ticketId: ticket.id,
        jobStatus: failedJob.status,
        ticketStatus: failedTicket.status,
        error: message,
      });

      return {
        outcome: "failed",
        jobId: job.id,
        ticketId: ticket.id,
        error: message,
      };
    }
  }
}
