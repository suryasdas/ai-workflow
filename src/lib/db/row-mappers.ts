import type { AnalysisJob, ReviewAction, Ticket, TicketAnalysis } from "@/lib/domain/types";

type TicketRow = {
  id: string;
  customer_email: string;
  subject: string;
  body: string;
  status: Ticket["status"];
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

type AnalysisRow = {
  id: string;
  ticket_id: string;
  provider: string;
  model: string;
  category: TicketAnalysis["category"];
  sentiment: string;
  priority: number;
  priority_reason: string;
  confidence: string | number;
  confidence_reason: string;
  summary: string;
  draft_reply: string;
  raw_output: unknown;
  created_at: Date;
};

type ReviewActionRow = {
  id: string;
  ticket_id: string;
  analysis_id: string | null;
  reviewer_name: string;
  decision: ReviewAction["decision"];
  final_reply: string | null;
  notes: string | null;
  created_at: Date;
};

type AnalysisJobRow = {
  id: string;
  ticket_id: string;
  status: AnalysisJob["status"];
  attempt_count: number;
  last_error: string | null;
  locked_at: Date | null;
  available_at: Date;
  created_at: Date;
  updated_at: Date;
};

export function mapTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    customerEmail: row.customer_email,
    subject: row.subject,
    body: row.body,
    status: row.status,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAnalysis(row: AnalysisRow): TicketAnalysis {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    provider: row.provider,
    model: row.model,
    category: row.category,
    sentiment: row.sentiment,
    priority: row.priority,
    priorityReason: row.priority_reason,
    confidence: Number(row.confidence),
    confidenceReason: row.confidence_reason,
    summary: row.summary,
    draftReply: row.draft_reply,
    rawOutput: row.raw_output,
    createdAt: row.created_at,
  };
}

export function mapReviewAction(row: ReviewActionRow): ReviewAction {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    analysisId: row.analysis_id,
    reviewerName: row.reviewer_name,
    decision: row.decision,
    finalReply: row.final_reply,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function mapAnalysisJob(row: AnalysisJobRow): AnalysisJob {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    status: row.status,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    lockedAt: row.locked_at,
    availableAt: row.available_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
