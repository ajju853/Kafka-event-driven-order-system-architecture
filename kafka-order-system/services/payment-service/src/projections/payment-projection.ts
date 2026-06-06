import { PoolClient } from "pg";
import { randomUUID } from "crypto";
import { logger } from "../utils/logger";

export async function projectPaymentEvent(
  client: PoolClient,
  event: { eventType: string; aggregateId: string; payload: Record<string, unknown>; timestamp: Date }
): Promise<void> {
  const { orderId, customerId, amount, transactionId, paymentId, errorMessage, status } =
    event.payload as Record<string, unknown>;

  switch (event.eventType) {
    case "PaymentProcessed":
      await client.query(
        `INSERT INTO payments (id, order_id, customer_id, amount, status, transaction_id, processed_at)
         VALUES ($1, $2, $3, $4, 'SUCCESS', $5, NOW())
         ON CONFLICT DO NOTHING`,
        [paymentId || randomUUID(), orderId, customerId, amount, transactionId || ""]
      );
      logger.debug("Payment processed projected", { orderId });
      break;

    case "PaymentFailed":
      await client.query(
        `INSERT INTO payments (id, order_id, customer_id, amount, status, transaction_id, error_message, processed_at)
         VALUES ($1, $2, $3, $4, 'FAILED', $5, $6, NOW())
         ON CONFLICT DO NOTHING`,
        [paymentId || randomUUID(), orderId, customerId, amount, transactionId || "", errorMessage || ""]
      );
      logger.debug("Payment failed projected", { orderId });
      break;
  }
}
