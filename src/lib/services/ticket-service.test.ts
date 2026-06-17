import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiProviderResult } from "@/lib/ai/types";
import type { AiAnalysisOutput, ReviewAction, Ticket } from "@/lib/domain/types";

const mockPool = {
  connect: vi.fn(),
};

const mockProvider = {
  analyzeTicket: vi.fn(),
};

const mockTicketRepository = {
  create: vi.fn(),
  updateStatus: vi.fn(),
  findById: vi.fn(),
  list: vi.fn(),
};

const mockAnalysisRepository = {
  create: vi.fn(),
  findLatestForTicket: vi.fn(),
};

const mockReviewRepository = {
  create: vi.fn(),
  listForTicket: vi.fn(),
};

vi.mock("@/lib/db/client", () => ({
  getPool: () => mockPool,
}));

vi.mock("@/lib/ai/provider-factory", () => ({
  createAiProvider: () => mockProvider,
}));

vi.mock("@/lib/repositories/ticket-repository", () => ({
  TicketRepository: class TicketRepository {
    create = mockTicketRepository.create;
    updateStatus = mockTicketRepository.updateStatus;
    findById = mockTicketRepository.findById;
    list = mockTicketRepository.list;
  },
}));

vi.mock("@/lib/repositories/analysis-repository", () => ({
  AnalysisRepository: class AnalysisRepository {
    create = mockAnalysisRepository.create;
    findLatestForTicket = mockAnalysisRepository.findLatestForTicket;
  },
}));

vi.mock("@/lib/repositories/review-repository", () => ({
  ReviewRepository: class ReviewRepository {
    create = mockReviewRepository.create;
    listForTicket = mockReviewRepository.listForTicket;
  },
}));

vi.mock("@/lib/logger", () => ({
  workflowLog: vi.fn(),
}));

import { TicketService } from "./ticket-service";

const baseTicket: Ticket = {
  id: "f62ef22f-663b-4c3c-b4d4-fdf3405cda17",
  customerEmail: "taylor@example.com",
  subject: "Charged twice for my subscription",
  body: "I was charged twice today for the same subscription renewal. Please help.",
  status: "new",
  failureReason: null,
  createdAt: new Date("2026-06-17T00:00:00.000Z"),
  updatedAt: new Date("2026-06-17T00:00:00.000Z"),
};

const processingTicket: Ticket = {
  ...baseTicket,
  status: "processing",
  updatedAt: new Date("2026-06-17T00:00:01.000Z"),
};

const processedTicket: Ticket = {
  ...baseTicket,
  status: "processed",
  updatedAt: new Date("2026-06-17T00:00:02.000Z"),
};

const approvedTicket: Ticket = {
  ...baseTicket,
  status: "approved",
  updatedAt: new Date("2026-06-17T00:00:03.000Z"),
};

const failedTicket: Ticket = {
  ...baseTicket,
  status: "failed",
  failureReason: "Claude timed out",
  updatedAt: new Date("2026-06-17T00:00:03.000Z"),
};

const validOutput: AiAnalysisOutput = {
  category: "refund_request",
  sentiment: "frustrated",
  priority: 4,
  priorityReason: "Duplicate billing creates direct financial impact and needs fast support attention.",
  confidence: 0.97,
  confidenceReason: "The customer explicitly reports a duplicate charge, which strongly matches a refund issue.",
  summary: "Customer says they were charged twice for the same subscription renewal today.",
  draftReply:
    "I am sorry about the duplicate subscription charge. I am reviewing the billing record now and will help make sure the extra charge is resolved quickly.",
};

const baseProviderResult: AiProviderResult = {
  provider: "anthropic",
  model: "claude-opus-4-6",
  output: validOutput,
  rawOutput: { id: "msg_123" },
};

const baseReviewAction: ReviewAction = {
  id: "f4bdb017-7dca-4d55-b382-d2ebfa5d8cd8",
  ticketId: baseTicket.id,
  analysisId: "1881cbc7-d629-49ce-b092-bd1bab7f53f8",
  reviewerName: "Riley",
  decision: "approved",
  finalReply:
    "I am sorry about the duplicate charge. We are reviewing the transaction and will follow up shortly.",
  notes: "Looks good.",
  createdAt: new Date("2026-06-17T00:05:00.000Z"),
};

function createFakeClient() {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

describe("TicketService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.connect.mockReset();
    mockProvider.analyzeTicket.mockReset();
    mockTicketRepository.create.mockReset();
    mockTicketRepository.updateStatus.mockReset();
    mockTicketRepository.findById.mockReset();
    mockTicketRepository.list.mockReset();
    mockAnalysisRepository.create.mockReset();
    mockAnalysisRepository.findLatestForTicket.mockReset();
    mockReviewRepository.create.mockReset();
    mockReviewRepository.listForTicket.mockReset();
  });

  it("submits a ticket, runs AI analysis, saves the analysis, and marks the ticket processed", async () => {
    mockTicketRepository.create.mockResolvedValue(baseTicket);
    mockTicketRepository.findById.mockResolvedValue(processingTicket);
    mockTicketRepository.updateStatus.mockImplementation(async (_id: string, status: string) => {
      if (status === "processing") {
        return processingTicket;
      }

      if (status === "processed") {
        return processedTicket;
      }

      throw new Error(`Unexpected status update in test: ${status}`);
    });
    mockProvider.analyzeTicket.mockResolvedValue(baseProviderResult);
    mockAnalysisRepository.create.mockResolvedValue({
      id: "1881cbc7-d629-49ce-b092-bd1bab7f53f8",
      ticketId: baseTicket.id,
      provider: "anthropic",
      model: "claude-opus-4-6",
      category: validOutput.category,
      sentiment: validOutput.sentiment,
      priority: validOutput.priority,
      priorityReason: validOutput.priorityReason,
      confidence: validOutput.confidence,
      confidenceReason: validOutput.confidenceReason,
      summary: validOutput.summary,
      draftReply: validOutput.draftReply,
      rawOutput: baseProviderResult.rawOutput,
      createdAt: new Date("2026-06-17T00:00:02.000Z"),
    });

    const service = new TicketService();
    const result = await service.submitTicket({
      customerEmail: baseTicket.customerEmail,
      subject: baseTicket.subject,
      body: baseTicket.body,
    });

    expect(result).toEqual(baseTicket);
    expect(mockTicketRepository.create).toHaveBeenCalledWith({
      customerEmail: baseTicket.customerEmail,
      subject: baseTicket.subject,
      body: baseTicket.body,
    });
    expect(mockTicketRepository.updateStatus).toHaveBeenNthCalledWith(1, baseTicket.id, "processing");
    expect(mockProvider.analyzeTicket).toHaveBeenCalledWith({
      ticket: processingTicket,
    });
    expect(mockAnalysisRepository.create).toHaveBeenCalledWith({
      ticketId: baseTicket.id,
      provider: "anthropic",
      model: "claude-opus-4-6",
      output: validOutput,
      rawOutput: baseProviderResult.rawOutput,
    });
    expect(mockTicketRepository.updateStatus).toHaveBeenNthCalledWith(2, baseTicket.id, "processed");
  });

  it("marks the ticket failed and rethrows when AI analysis fails", async () => {
    const failure = new Error("Claude timed out");

    mockTicketRepository.findById.mockResolvedValue(processingTicket);
    mockTicketRepository.updateStatus.mockImplementation(async (_id: string, status: string, reason?: string) => {
      if (status === "failed") {
        return {
          ...failedTicket,
          failureReason: reason ?? failedTicket.failureReason,
        };
      }

      throw new Error(`Unexpected status update in test: ${status}`);
    });
    mockProvider.analyzeTicket.mockRejectedValue(failure);

    const service = new TicketService();

    await expect(service.processTicket(baseTicket.id)).rejects.toThrow("Claude timed out");
    expect(mockAnalysisRepository.create).not.toHaveBeenCalled();
    expect(mockTicketRepository.updateStatus).toHaveBeenCalledWith(baseTicket.id, "failed", "Claude timed out");
  });

  it("creates a review action, updates the ticket status, and commits the transaction", async () => {
    const client = createFakeClient();
    mockPool.connect.mockResolvedValue(client);
    mockReviewRepository.create.mockResolvedValue(baseReviewAction);
    mockTicketRepository.updateStatus.mockResolvedValue(approvedTicket);

    const service = new TicketService();
    const result = await service.reviewTicket({
      ticketId: baseTicket.id,
      analysisId: baseReviewAction.analysisId ?? undefined,
      reviewerName: "Riley",
      decision: "approved",
      finalReply: baseReviewAction.finalReply ?? undefined,
      notes: baseReviewAction.notes ?? undefined,
    });

    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mockReviewRepository.create).toHaveBeenCalledWith({
      ticketId: baseTicket.id,
      analysisId: baseReviewAction.analysisId,
      reviewerName: "Riley",
      decision: "approved",
      finalReply: baseReviewAction.finalReply,
      notes: baseReviewAction.notes,
    });
    expect(mockTicketRepository.updateStatus).toHaveBeenCalledWith(baseTicket.id, "approved");
    expect(client.query).toHaveBeenNthCalledWith(2, "COMMIT");
    expect(client.release).toHaveBeenCalled();
    expect(result).toEqual(baseReviewAction);
  });

  it("rolls back the transaction when saving the review fails", async () => {
    const client = createFakeClient();
    const failure = new Error("insert failed");

    mockPool.connect.mockResolvedValue(client);
    mockReviewRepository.create.mockRejectedValue(failure);

    const service = new TicketService();

    await expect(
      service.reviewTicket({
        ticketId: baseTicket.id,
        reviewerName: "Riley",
        decision: "rejected",
        notes: "Needs a different reply.",
      }),
    ).rejects.toThrow("insert failed");

    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(2, "ROLLBACK");
    expect(mockTicketRepository.updateStatus).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });
});
