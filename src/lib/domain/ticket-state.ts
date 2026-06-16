import type { ReviewDecision, TicketStatus } from "./types";

const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
  new: ["processing"],
  processing: ["processed", "failed"],
  processed: ["approved", "rejected"],
  approved: [],
  failed: ["processing"],
  rejected: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus) {
  return allowedTransitions[from].includes(to);
}

export function assertTicketTransition(from: TicketStatus, to: TicketStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid ticket status transition: ${from} -> ${to}`);
  }
}

export function statusForReviewDecision(decision: ReviewDecision): TicketStatus {
  return decision === "rejected" ? "rejected" : "approved";
}
