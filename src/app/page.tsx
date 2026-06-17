import Link from "next/link";
import { ArrowRight, Inbox, Send } from "lucide-react";
import { submitTicketAction } from "./actions";
import { TicketSubmitForm } from "./ticket-submit-form";
import { TicketService } from "@/lib/services/ticket-service";
import type { Ticket } from "@/lib/domain/types";

const statusLabels = {
  new: "Queued",
  processing: "Processing",
  processed: "Ready for review",
  approved: "Approved",
  failed: "Failed",
  rejected: "Rejected",
};

export default async function HomePage() {
  let tickets: Ticket[] = [];
  let databaseError: string | null = null;

  try {
    tickets = await new TicketService().listTickets();
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Unable to connect to the database.";
  }

  return (
    <main className="shell">
      <section className="header-band">
        <div>
          <p className="eyebrow">Support triage</p>
          <h1>AI drafts. Humans decide.</h1>
          <p className="subtle">
            Submit a customer issue, let the workflow classify and draft a reply, then approve, edit, or reject it.
          </p>
        </div>
        <div className="status-strip" aria-label="Workflow states">
          <span>new</span>
          <ArrowRight size={16} />
          <span>processing</span>
          <ArrowRight size={16} />
          <span>processed</span>
          <ArrowRight size={16} />
          <span>approved</span>
        </div>
      </section>

      <section className="workspace-grid">
        <TicketSubmitForm action={submitTicketAction} />

        <section className="panel">
          <div className="panel-heading">
            <Inbox size={20} />
            <h2>Review Queue</h2>
          </div>

          {databaseError ? (
            <div className="empty-state">
              <strong>Database is not connected.</strong>
              <span>{databaseError}</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="empty-state">
              <strong>No tickets yet.</strong>
              <span>Submitted tickets will appear here for review.</span>
            </div>
          ) : (
            <div className="ticket-list">
              {tickets.map((ticket) => (
                <Link href={`/tickets/${ticket.id}`} className="ticket-row" key={ticket.id}>
                  <div>
                    <strong>{ticket.subject}</strong>
                    <span>{ticket.customerEmail}</span>
                  </div>
                  <span className={`status status-${ticket.status}`}>{statusLabels[ticket.status]}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
