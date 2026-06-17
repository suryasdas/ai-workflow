"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TicketService } from "@/lib/services/ticket-service";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function submitTicketAction(formData: FormData) {
  const service = new TicketService();
  const ticket = await service.submitTicket({
    customerEmail: readString(formData, "customerEmail"),
    subject: readString(formData, "subject"),
    body: readString(formData, "body"),
  });

  revalidatePath("/");
  redirect(`/tickets/${ticket.id}`);
}

export async function reviewTicketAction(formData: FormData) {
  const ticketId = readString(formData, "ticketId");
  const analysisId = readString(formData, "analysisId") || undefined;
  const decision = readString(formData, "decision");

  if (decision !== "approved" && decision !== "edited" && decision !== "rejected") {
    throw new Error("Invalid review decision.");
  }

  await new TicketService().reviewTicket({
    ticketId,
    analysisId,
    reviewerName: readString(formData, "reviewerName"),
    decision,
    finalReply: readString(formData, "finalReply"),
    notes: readString(formData, "notes"),
  });

  revalidatePath("/");
  revalidatePath(`/tickets/${ticketId}`);
}

export async function retryAnalysisJobAction(formData: FormData) {
  const ticketId = readString(formData, "ticketId");

  await new TicketService().retryAnalysisJob(ticketId);

  revalidatePath("/");
  revalidatePath(`/tickets/${ticketId}`);
}
