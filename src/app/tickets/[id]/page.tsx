import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Pencil, X } from "lucide-react";
import { reviewTicketAction } from "@/app/actions";
import { TicketService } from "@/lib/services/ticket-service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function TicketPage({ params }: Props) {
  const { id } = await params;
  const details = await new TicketService().getTicketWithDetails(id);

  if (!details) {
    notFound();
  }

  const { ticket, latestAnalysis, reviewActions } = details;
  const canReview = ticket.status === "processed" && latestAnalysis;

  return (
    <main className="shell">
      <Link className="back-link" href="/">
        <ArrowLeft size={18} />
        Back to queue
      </Link>

      <section className="detail-layout">
        <article className="panel">
          <p className="eyebrow">{ticket.status}</p>
          <h1>{ticket.subject}</h1>
          <p className="subtle">{ticket.customerEmail}</p>
          <div className="message-box">{ticket.body}</div>
          {ticket.failureReason ? <p className="error-text">{ticket.failureReason}</p> : null}
        </article>

        <aside className="panel">
          <h2>AI Analysis</h2>
          {latestAnalysis ? (
            <div className="analysis-grid">
              <span>Category</span>
              <strong>{latestAnalysis.category.replace("_", " ")}</strong>
              <span>Sentiment</span>
              <strong>{latestAnalysis.sentiment}</strong>
              <span>Priority</span>
              <strong>{latestAnalysis.priority}/5</strong>
              <span>Priority reason</span>
              <strong>{latestAnalysis.priorityReason}</strong>
              <span>Category confidence</span>
              <strong>{Math.round(latestAnalysis.confidence * 100)}%</strong>
              <span>Category confidence reason</span>
              <strong>{latestAnalysis.confidenceReason}</strong>
            </div>
          ) : (
            <p className="subtle">No analysis has been saved yet.</p>
          )}
        </aside>
      </section>

      <section className="workspace-grid">
        <article className="panel">
          <h2>Draft Reply</h2>
          {latestAnalysis ? (
            <>
              <p>{latestAnalysis.summary}</p>
              <pre className="draft-box">{latestAnalysis.draftReply}</pre>
            </>
          ) : (
            <p className="subtle">The AI draft will appear here once processing completes.</p>
          )}
        </article>

        <form action={reviewTicketAction} className="panel form-panel">
          <h2>Human Review</h2>
          <input type="hidden" name="ticketId" value={ticket.id} />
          {latestAnalysis ? <input type="hidden" name="analysisId" value={latestAnalysis.id} /> : null}
          <label>
            Reviewer
            <input name="reviewerName" required placeholder="Avery" />
          </label>
          <label>
            Final reply
            <textarea
              name="finalReply"
              rows={8}
              defaultValue={latestAnalysis?.draftReply ?? ""}
              disabled={!canReview}
            />
          </label>
          <label>
            Notes
            <textarea name="notes" rows={4} placeholder="Why did you make this decision?" disabled={!canReview} />
          </label>
          <div className="button-row">
            <button name="decision" value="approved" className="primary-button" disabled={!canReview}>
              <Check size={18} />
              Approve
            </button>
            <button name="decision" value="edited" className="secondary-button" disabled={!canReview}>
              <Pencil size={18} />
              Save edit
            </button>
            <button name="decision" value="rejected" className="danger-button" disabled={!canReview}>
              <X size={18} />
              Reject
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Review History</h2>
        {reviewActions.length === 0 ? (
          <p className="subtle">No human decisions recorded yet.</p>
        ) : (
          <div className="history-list">
            {reviewActions.map((action) => (
              <div key={action.id} className="history-row">
                <strong>{action.decision}</strong>
                <span>{action.reviewerName}</span>
                <span>{action.createdAt.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
