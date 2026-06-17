import type { Pool, PoolClient } from "pg";
import type { AnalysisJob } from "@/lib/domain/types";
import { mapAnalysisJob } from "@/lib/db/row-mappers";

type Db = Pool | PoolClient;

export class AnalysisJobRepository {
  constructor(private readonly db: Db) {}

  async create(params: { ticketId: string; availableAt?: Date }): Promise<AnalysisJob> {
    const result = await this.db.query(
      `
        INSERT INTO analysis_jobs (ticket_id, available_at)
        VALUES ($1, $2)
        RETURNING *
      `,
      [params.ticketId, params.availableAt ?? new Date()],
    );

    return mapAnalysisJob(result.rows[0]);
  }

  async findByTicketId(ticketId: string): Promise<AnalysisJob | null> {
    const result = await this.db.query(
      `
        SELECT *
        FROM analysis_jobs
        WHERE ticket_id = $1
      `,
      [ticketId],
    );

    return result.rowCount === 0 ? null : mapAnalysisJob(result.rows[0]);
  }

  async claimNextAvailable(): Promise<AnalysisJob | null> {
    const result = await this.db.query(
      `
        WITH next_job AS (
          SELECT id
          FROM analysis_jobs
          WHERE status = 'queued'
            AND available_at <= now()
          ORDER BY available_at ASC, created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE analysis_jobs
        SET status = 'processing',
            attempt_count = attempt_count + 1,
            locked_at = now(),
            updated_at = now()
        WHERE id = (SELECT id FROM next_job)
        RETURNING *
      `,
    );

    return result.rowCount === 0 ? null : mapAnalysisJob(result.rows[0]);
  }

  async markCompleted(id: string): Promise<AnalysisJob> {
    const result = await this.db.query(
      `
        UPDATE analysis_jobs
        SET status = 'completed',
            last_error = NULL,
            locked_at = NULL,
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id],
    );

    return mapAnalysisJob(result.rows[0]);
  }

  async markFailed(id: string, lastError: string): Promise<AnalysisJob> {
    const result = await this.db.query(
      `
        UPDATE analysis_jobs
        SET status = 'failed',
            last_error = $2,
            locked_at = NULL,
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, lastError],
    );

    return mapAnalysisJob(result.rows[0]);
  }

  async requeue(id: string, availableAt = new Date()): Promise<AnalysisJob> {
    const result = await this.db.query(
      `
        UPDATE analysis_jobs
        SET status = 'queued',
            last_error = NULL,
            locked_at = NULL,
            available_at = $2,
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, availableAt],
    );

    return mapAnalysisJob(result.rows[0]);
  }
}
