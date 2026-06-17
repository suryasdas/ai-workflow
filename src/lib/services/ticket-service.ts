import { getPool } from "@/lib/db/client";
import { createTicketSchema, reviewTicketSchema } from "@/lib/domain/types";
import type { CreateTicketInput, ReviewTicketInput, TicketWithDetails } from "@/lib/domain/types";
import { statusForReviewDecision } from "@/lib/domain/ticket-state";
import { AnalysisJobRepository } from "@/lib/repositories/analysis-job-repository";
import { AnalysisRepository } from "@/lib/repositories/analysis-repository";
import { ReviewRepository } from "@/lib/repositories/review-repository";
import { TicketRepository } from "@/lib/repositories/ticket-repository";
import { workflowLog } from "@/lib/logger";

export class TicketService {
  private readonly pool = getPool();

  async submitTicket(input: CreateTicketInput) {
    const parsed = createTicketSchema.parse(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const tickets = new TicketRepository(client);
      const jobs = new AnalysisJobRepository(client);

      workflowLog("validated ticket submission", {
        customerEmail: parsed.customerEmail,
        subject: parsed.subject,
      });

      const ticket = await tickets.create(parsed);
      workflowLog("saved ticket for async analysis pipeline", {
        ticketId: ticket.id,
        status: ticket.status,
      });

      const job = await jobs.create({
        ticketId: ticket.id,
      });
      workflowLog("enqueued analysis job for background worker", {
        jobId: job.id,
        ticketId: ticket.id,
        jobStatus: job.status,
        availableAt: job.availableAt.toISOString(),
      });

      await client.query("COMMIT");
      workflowLog("ticket submission transaction committed", {
        ticketId: ticket.id,
        jobId: job.id,
        nextStep: "background worker will claim the queued job",
      });
      return ticket;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
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

  async retryAnalysisJob(ticketId: string) {
    workflowLog("analysis job retry requested", {
      ticketId,
    });

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const tickets = new TicketRepository(client);
      const jobs = new AnalysisJobRepository(client);
      const ticket = await tickets.findById(ticketId);

      if (!ticket) {
        workflowLog("analysis job retry rejected", {
          ticketId,
          reason: "ticket_not_found",
        });
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      const job = await jobs.findByTicketId(ticketId);

      if (!job) {
        workflowLog("analysis job retry rejected", {
          ticketId,
          reason: "analysis_job_not_found",
        });
        throw new Error(`Analysis job not found for ticket: ${ticketId}`);
      }

      if (job.status !== "failed") {
        workflowLog("analysis job retry rejected", {
          ticketId,
          jobId: job.id,
          reason: "job_not_failed",
          currentJobStatus: job.status,
        });
        throw new Error(`Only failed analysis jobs can be retried. Current status: ${job.status}`);
      }

      const requeuedJob = await jobs.requeue(job.id);
      workflowLog("analysis job retry accepted", {
        ticketId,
        jobId: requeuedJob.id,
        previousJobStatus: job.status,
        nextJobStatus: requeuedJob.status,
        attemptCount: requeuedJob.attemptCount,
        availableAt: requeuedJob.availableAt.toISOString(),
      });

      await client.query("COMMIT");
      workflowLog("analysis job retry committed", {
        ticketId,
        jobId: requeuedJob.id,
        ticketStatus: ticket.status,
        jobStatus: requeuedJob.status,
      });

      return requeuedJob;
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
    const jobs = new AnalysisJobRepository(this.pool);
    const reviews = new ReviewRepository(this.pool);
    const ticket = await tickets.findById(ticketId);

    if (!ticket) {
      return null;
    }

    return {
      ticket,
      latestAnalysis: await analyses.findLatestForTicket(ticketId),
      analysisJob: await jobs.findByTicketId(ticketId),
      reviewActions: await reviews.listForTicket(ticketId),
    };
  }
}
