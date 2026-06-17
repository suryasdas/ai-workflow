import { z } from "zod";

export const ticketStatuses = [
  "new",
  "processing",
  "processed",
  "approved",
  "failed",
  "rejected",
] as const;

export const ticketCategories = [
  "damaged_item",
  "refund_request",
  "shipping_issue",
  "account_issue",
  "technical_issue",
  "other",
] as const;

export const reviewDecisions = ["approved", "edited", "rejected"] as const;

export type TicketStatus = (typeof ticketStatuses)[number];
export type TicketCategory = (typeof ticketCategories)[number];
export type ReviewDecision = (typeof reviewDecisions)[number];

export const createTicketSchema = z.object({
  customerEmail: z.string().email(),
  subject: z.string().trim().min(3).max(180),
  body: z.string().trim().min(10).max(5000),
});

export const aiAnalysisSchema = z.object({
  category: z.enum(ticketCategories),
  sentiment: z.string().trim().min(2).max(80),
  priority: z.number().int().min(1).max(5),
  priorityReason: z.string().trim().min(10).max(1000),
  confidence: z.number().min(0).max(1),
  confidenceReason: z.string().trim().min(10).max(1000),
  summary: z.string().trim().min(10).max(1000),
  draftReply: z.string().trim().min(10).max(3000),
});

export const reviewTicketSchema = z.object({
  ticketId: z.string().uuid(),
  analysisId: z.string().uuid().optional(),
  reviewerName: z.string().trim().min(2).max(120),
  decision: z.enum(reviewDecisions),
  finalReply: z.string().trim().max(3000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type AiAnalysisOutput = z.infer<typeof aiAnalysisSchema>;
export type ReviewTicketInput = z.infer<typeof reviewTicketSchema>;

export type Ticket = {
  id: string;
  customerEmail: string;
  subject: string;
  body: string;
  status: TicketStatus;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TicketAnalysis = {
  id: string;
  ticketId: string;
  provider: string;
  model: string;
  category: TicketCategory;
  sentiment: string;
  priority: number;
  priorityReason: string;
  confidence: number;
  confidenceReason: string;
  summary: string;
  draftReply: string;
  rawOutput: unknown;
  createdAt: Date;
};

export type ReviewAction = {
  id: string;
  ticketId: string;
  analysisId: string | null;
  reviewerName: string;
  decision: ReviewDecision;
  finalReply: string | null;
  notes: string | null;
  createdAt: Date;
};

export type TicketWithDetails = {
  ticket: Ticket;
  latestAnalysis: TicketAnalysis | null;
  reviewActions: ReviewAction[];
};
