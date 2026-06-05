import { Pool } from "pg";
import { logger } from "../utils/logger";

export class AuditService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async recordEvent(event: Record<string, unknown>): Promise<void> {
    const { eventId, eventType, orderId, customerId, timestamp, version } = event as any;
    await this.pool.query(
      `INSERT INTO audit_log (event_id, event_type, order_id, customer_id, payload, schema_version, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (event_id) DO NOTHING`,
      [
        eventId,
        eventType,
        orderId,
        customerId,
        JSON.stringify(event),
        version || 1,
      ]
    );
    logger.debug("Audit event recorded", { eventId, eventType });
  }

  async getEventsByOrder(orderId: string, limit = 50): Promise<unknown[]> {
    const result = await this.pool.query(
      "SELECT * FROM audit_log WHERE order_id = $1 ORDER BY recorded_at DESC LIMIT $2",
      [orderId, limit]
    );
    return result.rows;
  }

  async getEventsByType(eventType: string, limit = 50): Promise<unknown[]> {
    const result = await this.pool.query(
      "SELECT * FROM audit_log WHERE event_type = $1 ORDER BY recorded_at DESC LIMIT $2",
      [eventType, limit]
    );
    return result.rows;
  }
}
