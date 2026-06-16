import type { Pool, PoolClient } from "pg";
import type { ReviewAction, ReviewTicketInput } from "@/lib/domain/types";
import { mapReviewAction } from "@/lib/db/row-mappers";

type Db = Pool | PoolClient;

export class ReviewRepository {
  constructor(private readonly db: Db) {}

  async create(input: ReviewTicketInput): Promise<ReviewAction> {
    const result = await this.db.query(
      `
        INSERT INTO review_actions (
          ticket_id,
          analysis_id,
          reviewer_name,
          decision,
          final_reply,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        input.ticketId,
        input.analysisId ?? null,
        input.reviewerName,
        input.decision,
        input.finalReply ?? null,
        input.notes ?? null,
      ],
    );

    return mapReviewAction(result.rows[0]);
  }

  async listForTicket(ticketId: string): Promise<ReviewAction[]> {
    const result = await this.db.query(
      `
        SELECT *
        FROM review_actions
        WHERE ticket_id = $1
        ORDER BY created_at DESC
      `,
      [ticketId],
    );

    return result.rows.map(mapReviewAction);
  }
}
