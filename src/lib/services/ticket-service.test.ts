import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisJob, ReviewAction, Ticket, TicketAnalysis } from "@/lib/domain/types";

const mockPool = {
  connect: vi.fn(),
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

const mockAnalysisJobRepository = {
  create: vi.fn(),
  findByTicketId: vi.fn(),
  requeue: vi.fn(),
};

const mockReviewRepository = {
  create: vi.fn(),
  listForTicket: vi.fn(),
};

vi.mock("@/lib/db/client", () => ({
  getPool: () => mockPool,
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

vi.mock("@/lib/repositories/analysis-job-repository", () => ({
  AnalysisJobRepository: class AnalysisJobRepository {
    create = mockAnalysisJobRepository.create;
    findByTicketId = mockAnalysisJobRepository.findByTicketId;
    requeue = mockAnalysisJobRepository.requeue;
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

const baseJob: AnalysisJob = {
  id: "397cdcb6-b8bf-470f-824e-500bc3324a0f",
  ticketId: baseTicket.id,
  status: "queued",
  attemptCount: 0,
  lastError: null,
  lockedAt: null,
  availableAt: new Date("2026-06-17T00:00:00.000Z"),
  createdAt: new Date("2026-06-17T00:00:00.000Z"),
  updatedAt: new Date("2026-06-17T00:00:00.000Z"),
};

const baseAnalysis: TicketAnalysis = {
  id: "1881cbc7-d629-49ce-b092-bd1bab7f53f8",
  ticketId: baseTicket.id,
  provider: "anthropic",
  model: "claude-opus-4-6",
  category: "refund_request",
  sentiment: "frustrated",
  priority: 4,
  priorityReason: "Duplicate billing creates direct financial impact and needs fast support attention.",
  confidence: 0.97,
  confidenceReason: "The customer explicitly reports a duplicate charge, which strongly matches a refund issue.",
  summary: "Customer says they were charged twice for the same subscription renewal today.",
  draftReply:
    "I am sorry about the duplicate subscription charge. I am reviewing the billing record now and will help make sure the extra charge is resolved quickly.",
  rawOutput: { id: "msg_123" },
  createdAt: new Date("2026-06-17T00:00:02.000Z"),
};

const failedTicket: Ticket = {
  ...baseTicket,
  status: "failed",
  failureReason: "Anthropic API request failed: 529 overloaded",
  updatedAt: new Date("2026-06-17T00:00:04.000Z"),
};

const failedJob: AnalysisJob = {
  ...baseJob,
  status: "failed",
  attemptCount: 1,
  lastError: "Anthropic API request failed: 529 overloaded",
  updatedAt: new Date("2026-06-17T00:00:04.000Z"),
};

const requeuedJob: AnalysisJob = {
  ...failedJob,
  status: "queued",
  lastError: null,
  availableAt: new Date("2026-06-17T00:00:05.000Z"),
  updatedAt: new Date("2026-06-17T00:00:05.000Z"),
};

const approvedTicket: Ticket = {
  ...baseTicket,
  status: "approved",
  updatedAt: new Date("2026-06-17T00:00:03.000Z"),
};

const baseReviewAction: ReviewAction = {
  id: "f4bdb017-7dca-4d55-b382-d2ebfa5d8cd8",
  ticketId: baseTicket.id,
  analysisId: baseAnalysis.id,
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
    mockTicketRepository.create.mockReset();
    mockTicketRepository.updateStatus.mockReset();
    mockTicketRepository.findById.mockReset();
    mockTicketRepository.list.mockReset();
    mockAnalysisRepository.create.mockReset();
    mockAnalysisRepository.findLatestForTicket.mockReset();
    mockAnalysisJobRepository.create.mockReset();
    mockAnalysisJobRepository.findByTicketId.mockReset();
    mockAnalysisJobRepository.requeue.mockReset();
    mockReviewRepository.create.mockReset();
    mockReviewRepository.listForTicket.mockReset();
  });

  it("submits a ticket and enqueues an analysis job", async () => {
    const client = createFakeClient();
    mockPool.connect.mockResolvedValue(client);
    mockTicketRepository.create.mockResolvedValue(baseTicket);
    mockAnalysisJobRepository.create.mockResolvedValue(baseJob);

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
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mockAnalysisJobRepository.create).toHaveBeenCalledWith({
      ticketId: baseTicket.id,
    });
    expect(client.query).toHaveBeenNthCalledWith(2, "COMMIT");
    expect(client.release).toHaveBeenCalled();
    expect(mockTicketRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockAnalysisRepository.create).not.toHaveBeenCalled();
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

  it("requeues a failed analysis job and leaves the ticket status unchanged", async () => {
    const client = createFakeClient();
    mockPool.connect.mockResolvedValue(client);
    mockTicketRepository.findById.mockResolvedValue(failedTicket);
    mockAnalysisJobRepository.findByTicketId.mockResolvedValue(failedJob);
    mockAnalysisJobRepository.requeue.mockResolvedValue(requeuedJob);

    const service = new TicketService();
    const result = await service.retryAnalysisJob(baseTicket.id);

    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mockTicketRepository.findById).toHaveBeenCalledWith(baseTicket.id);
    expect(mockAnalysisJobRepository.findByTicketId).toHaveBeenCalledWith(baseTicket.id);
    expect(mockAnalysisJobRepository.requeue).toHaveBeenCalledWith(failedJob.id);
    expect(mockTicketRepository.updateStatus).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenNthCalledWith(2, "COMMIT");
    expect(client.release).toHaveBeenCalled();
    expect(result).toEqual(requeuedJob);
  });

  it("rejects retry when the ticket has no analysis job", async () => {
    const client = createFakeClient();
    mockPool.connect.mockResolvedValue(client);
    mockTicketRepository.findById.mockResolvedValue(failedTicket);
    mockAnalysisJobRepository.findByTicketId.mockResolvedValue(null);

    const service = new TicketService();

    await expect(service.retryAnalysisJob(baseTicket.id)).rejects.toThrow(
      `Analysis job not found for ticket: ${baseTicket.id}`,
    );

    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(2, "ROLLBACK");
    expect(mockAnalysisJobRepository.requeue).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });

  it.each(["queued", "processing", "completed"] as const)(
    "rejects retry when the analysis job status is %s",
    async (status) => {
      const client = createFakeClient();
      mockPool.connect.mockResolvedValue(client);
      mockTicketRepository.findById.mockResolvedValue(failedTicket);
      mockAnalysisJobRepository.findByTicketId.mockResolvedValue({
        ...failedJob,
        status,
      });

      const service = new TicketService();

      await expect(service.retryAnalysisJob(baseTicket.id)).rejects.toThrow(
        `Only failed analysis jobs can be retried. Current status: ${status}`,
      );

      expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
      expect(client.query).toHaveBeenNthCalledWith(2, "ROLLBACK");
      expect(mockAnalysisJobRepository.requeue).not.toHaveBeenCalled();
      expect(client.release).toHaveBeenCalled();
    },
  );

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

  it("returns the ticket, latest analysis, analysis job, and review history", async () => {
    mockTicketRepository.findById.mockResolvedValue(baseTicket);
    mockAnalysisRepository.findLatestForTicket.mockResolvedValue(baseAnalysis);
    mockAnalysisJobRepository.findByTicketId.mockResolvedValue(baseJob);
    mockReviewRepository.listForTicket.mockResolvedValue([baseReviewAction]);

    const service = new TicketService();
    const result = await service.getTicketWithDetails(baseTicket.id);

    expect(result).toEqual({
      ticket: baseTicket,
      latestAnalysis: baseAnalysis,
      analysisJob: baseJob,
      reviewActions: [baseReviewAction],
    });
  });
});
