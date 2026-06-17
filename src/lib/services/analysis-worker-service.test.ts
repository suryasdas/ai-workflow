import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiProviderResult } from "@/lib/ai/types";
import type { AiAnalysisOutput, AnalysisJob, Ticket } from "@/lib/domain/types";

const mockProvider = {
  analyzeTicket: vi.fn(),
};

const mockTicketRepository = {
  findById: vi.fn(),
  updateStatus: vi.fn(),
};

const mockAnalysisRepository = {
  create: vi.fn(),
};

const mockAnalysisJobRepository = {
  claimNextAvailable: vi.fn(),
  markCompleted: vi.fn(),
  markFailed: vi.fn(),
};

vi.mock("@/lib/db/client", () => ({
  getPool: () => ({}),
}));

vi.mock("@/lib/ai/provider-factory", () => ({
  createAiProvider: () => mockProvider,
}));

vi.mock("@/lib/repositories/ticket-repository", () => ({
  TicketRepository: class TicketRepository {
    findById = mockTicketRepository.findById;
    updateStatus = mockTicketRepository.updateStatus;
  },
}));

vi.mock("@/lib/repositories/analysis-repository", () => ({
  AnalysisRepository: class AnalysisRepository {
    create = mockAnalysisRepository.create;
  },
}));

vi.mock("@/lib/repositories/analysis-job-repository", () => ({
  AnalysisJobRepository: class AnalysisJobRepository {
    claimNextAvailable = mockAnalysisJobRepository.claimNextAvailable;
    markCompleted = mockAnalysisJobRepository.markCompleted;
    markFailed = mockAnalysisJobRepository.markFailed;
  },
}));

vi.mock("@/lib/logger", () => ({
  workflowLog: vi.fn(),
}));

import { AnalysisWorkerService } from "./analysis-worker-service";

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

const baseJob: AnalysisJob = {
  id: "397cdcb6-b8bf-470f-824e-500bc3324a0f",
  ticketId: baseTicket.id,
  status: "processing",
  attemptCount: 1,
  lastError: null,
  lockedAt: new Date("2026-06-17T00:00:01.000Z"),
  availableAt: new Date("2026-06-17T00:00:00.000Z"),
  createdAt: new Date("2026-06-17T00:00:00.000Z"),
  updatedAt: new Date("2026-06-17T00:00:01.000Z"),
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

describe("AnalysisWorkerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider.analyzeTicket.mockReset();
    mockTicketRepository.findById.mockReset();
    mockTicketRepository.updateStatus.mockReset();
    mockAnalysisRepository.create.mockReset();
    mockAnalysisJobRepository.claimNextAvailable.mockReset();
    mockAnalysisJobRepository.markCompleted.mockReset();
    mockAnalysisJobRepository.markFailed.mockReset();
  });

  it("returns idle when no job is available", async () => {
    mockAnalysisJobRepository.claimNextAvailable.mockResolvedValue(null);

    const service = new AnalysisWorkerService();
    await expect(service.processNextAvailableJob()).resolves.toEqual({ outcome: "idle" });
    expect(mockProvider.analyzeTicket).not.toHaveBeenCalled();
  });

  it("processes a claimed job and marks it completed", async () => {
    mockAnalysisJobRepository.claimNextAvailable.mockResolvedValue(baseJob);
    mockTicketRepository.findById.mockResolvedValue(baseTicket);
    mockTicketRepository.updateStatus.mockImplementation(async (_id: string, status: string) => {
      if (status === "processing") {
        return processingTicket;
      }

      return {
        ...processingTicket,
        status: "processed",
      };
    });
    mockProvider.analyzeTicket.mockResolvedValue(baseProviderResult);
    mockAnalysisRepository.create.mockResolvedValue({
      id: "1881cbc7-d629-49ce-b092-bd1bab7f53f8",
    });
    mockAnalysisJobRepository.markCompleted.mockResolvedValue({
      ...baseJob,
      status: "completed",
      lockedAt: null,
    });

    const service = new AnalysisWorkerService();
    await expect(service.processNextAvailableJob()).resolves.toEqual({
      outcome: "processed",
      jobId: baseJob.id,
      ticketId: baseTicket.id,
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
    expect(mockAnalysisJobRepository.markCompleted).toHaveBeenCalledWith(baseJob.id);
    expect(mockTicketRepository.updateStatus).toHaveBeenNthCalledWith(2, baseTicket.id, "processed");
  });

  it("marks the job and ticket failed when the provider throws", async () => {
    mockAnalysisJobRepository.claimNextAvailable.mockResolvedValue(baseJob);
    mockTicketRepository.findById.mockResolvedValue(baseTicket);
    mockTicketRepository.updateStatus.mockResolvedValue(processingTicket);
    mockProvider.analyzeTicket.mockRejectedValue(new Error("Claude timed out"));
    mockAnalysisJobRepository.markFailed.mockResolvedValue({
      ...baseJob,
      status: "failed",
      lastError: "Claude timed out",
      lockedAt: null,
    });

    const service = new AnalysisWorkerService();
    await expect(service.processNextAvailableJob()).resolves.toEqual({
      outcome: "failed",
      jobId: baseJob.id,
      ticketId: baseTicket.id,
      error: "Claude timed out",
    });

    expect(mockAnalysisJobRepository.markFailed).toHaveBeenCalledWith(baseJob.id, "Claude timed out");
    expect(mockTicketRepository.updateStatus).toHaveBeenNthCalledWith(2, baseTicket.id, "failed", "Claude timed out");
  });
});
