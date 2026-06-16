import type { Pool, PoolClient } from "pg";
import type { CreateTicketInput, Ticket, TicketStatus } from "@/lib/domain/types";
import { assertTicketTransition } from "@/lib/domain/ticket-state";
import { mapTicket } from "@/lib/db/row-mappers";

type Db = Pool | PoolClient;

export class TicketRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateTicketInput): Promise<Ticket> {
    const result = await this.db.query(
      `
        INSERT INTO tickets (customer_email, subject, body)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [input.customerEmail, input.subject, input.body],
    );

    return mapTicket(result.rows[0]);
  }

  async list(): Promise<Ticket[]> {
    const result = await this.db.query(`
      SELECT *
      FROM tickets
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return result.rows.map(mapTicket);
  }

  async findById(id: string): Promise<Ticket | null> {
    const result = await this.db.query("SELECT * FROM tickets WHERE id = $1", [id]);
    return result.rowCount === 0 ? null : mapTicket(result.rows[0]);
  }

  async updateStatus(id: string, status: TicketStatus, failureReason?: string): Promise<Ticket> {
    const current = await this.findById(id);

    if (!current) {
      throw new Error(`Ticket not found: ${id}`);
    }

    assertTicketTransition(current.status, status);

    const result = await this.db.query(
      `
        UPDATE tickets
        SET status = $2,
            failure_reason = $3,
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, status, failureReason ?? null],
    );

    return mapTicket(result.rows[0]);
  }
}
