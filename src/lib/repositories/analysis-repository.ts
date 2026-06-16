import type { Pool, PoolClient } from "pg";
import type { AiAnalysisOutput, TicketAnalysis } from "@/lib/domain/types";
import { mapAnalysis } from "@/lib/db/row-mappers";

type Db = Pool | PoolClient;

export class AnalysisRepository {
  constructor(private readonly db: Db) {}

  async create(params: {
    ticketId: string;
    provider: string;
    model: string;
    output: AiAnalysisOutput;
    rawOutput: unknown;
  }): Promise<TicketAnalysis> {
    const result = await this.db.query(
      `
        INSERT INTO ticket_analyses (
          ticket_id,
          provider,
          model,
          category,
          sentiment,
          priority,
          confidence,
          summary,
          draft_reply,
          raw_output
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      [
        params.ticketId,
        params.provider,
        params.model,
        params.output.category,
        params.output.sentiment,
        params.output.priority,
        params.output.confidence,
        params.output.summary,
        params.output.draftReply,
        JSON.stringify(params.rawOutput),
      ],
    );

    return mapAnalysis(result.rows[0]);
  }

  async findLatestForTicket(ticketId: string): Promise<TicketAnalysis | null> {
    const result = await this.db.query(
      `
        SELECT *
        FROM ticket_analyses
        WHERE ticket_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [ticketId],
    );

    return result.rowCount === 0 ? null : mapAnalysis(result.rows[0]);
  }
}
