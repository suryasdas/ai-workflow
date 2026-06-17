import { describe, expect, it } from "vitest";
import { assertTicketTransition, canTransition, statusForReviewDecision } from "./ticket-state";

describe("ticket state transitions", () => {
  it("allows valid workflow transitions", () => {
    expect(canTransition("new", "processing")).toBe(true);
    expect(canTransition("processing", "processed")).toBe(true);
    expect(canTransition("processing", "failed")).toBe(true);
    expect(canTransition("failed", "processing")).toBe(true);
    expect(canTransition("processed", "approved")).toBe(true);
    expect(canTransition("processed", "rejected")).toBe(true);
  });

  it("rejects invalid workflow transitions", () => {
    expect(canTransition("new", "approved")).toBe(false);
    expect(canTransition("approved", "processing")).toBe(false);
    expect(canTransition("rejected", "processed")).toBe(false);
  });

  it("throws for invalid asserted transitions", () => {
    expect(() => assertTicketTransition("new", "approved")).toThrow(
      "Invalid ticket status transition: new -> approved",
    );
  });

  it("does not throw for valid asserted transitions", () => {
    expect(() => assertTicketTransition("processing", "failed")).not.toThrow();
  });

  it("maps review decisions to final statuses", () => {
    expect(statusForReviewDecision("approved")).toBe("approved");
    expect(statusForReviewDecision("edited")).toBe("approved");
    expect(statusForReviewDecision("rejected")).toBe("rejected");
  });
});
