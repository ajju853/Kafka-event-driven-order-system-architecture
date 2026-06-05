import { Pool } from "pg";
import { logger } from "../utils/logger";

export class AnalyticsService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async recordOrderCreated(event: Record<string, unknown>): Promise<void> {
    const { orderId, customerId, totalAmount, items } = event as any;
    await this.pool.query(
      `INSERT INTO order_metrics (order_id, customer_id, total_amount, item_count, event_type, recorded_at)
       VALUES ($1, $2, $3, $4, 'ORDER_CREATED', NOW())`,
      [orderId, customerId, totalAmount, items?.length || 0]
    );
    logger.debug("Order created metric recorded", { orderId, totalAmount });
  }

  async recordPaymentProcessed(event: Record<string, unknown>): Promise<void> {
    const { orderId, totalAmount } = event as any;
    await this.pool.query(
      `INSERT INTO order_metrics (order_id, total_amount, event_type, recorded_at)
       VALUES ($1, $2, 'PAYMENT_PROCESSED', NOW())`,
      [orderId, totalAmount]
    );
  }

  async recordPaymentFailed(event: Record<string, unknown>): Promise<void> {
    const { orderId, errorMessage } = event as any;
    await this.pool.query(
      `INSERT INTO order_metrics (order_id, event_type, metadata, recorded_at)
       VALUES ($1, 'PAYMENT_FAILED', $2, NOW())`,
      [orderId, JSON.stringify({ error: errorMessage })]
    );
  }

  async getDailySummary(date: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE event_type = 'ORDER_CREATED') as orders_created,
        COUNT(*) FILTER (WHERE event_type = 'PAYMENT_PROCESSED') as payments_success,
        COUNT(*) FILTER (WHERE event_type = 'PAYMENT_FAILED') as payments_failed,
        COALESCE(SUM(total_amount) FILTER (WHERE event_type = 'ORDER_CREATED'), 0) as revenue
       FROM order_metrics
       WHERE DATE(recorded_at) = $1`,
      [date]
    );
    return result.rows[0] || {};
  }
}
