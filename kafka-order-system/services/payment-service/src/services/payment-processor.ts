import { v4 as uuidv4 } from "uuid";
import { pool } from "../models/db";
import { logger } from "../utils/logger";

export interface PaymentResult {
  transactionId: string;
  status: "SUCCESS" | "FAILED";
  errorMessage?: string;
}

const PAYMENT_SUCCESS_RATE = 0.9;

export async function processPayment(
  orderId: string,
  customerId: string,
  amount: number
): Promise<PaymentResult> {
  logger.info("Processing payment", { orderId, customerId, amount });

  await new Promise((resolve) => setTimeout(resolve, 200));

  const isSuccess = Math.random() < PAYMENT_SUCCESS_RATE;
  const transactionId = `txn_${uuidv4().replace(/-/g, "").slice(0, 16)}`;

  const client = await pool.connect();
  try {
    if (isSuccess) {
      await client.query(
        `INSERT INTO payments (id, order_id, customer_id, amount, status, transaction_id, processed_at)
         VALUES ($1, $2, $3, $4, 'SUCCESS', $5, NOW())`,
        [uuidv4(), orderId, customerId, amount, transactionId]
      );

      logger.info("Payment processed successfully", {
        orderId,
        transactionId,
      });

      return { transactionId, status: "SUCCESS" };
    } else {
      const errorMessage = "Payment declined: insufficient funds";

      await client.query(
        `INSERT INTO payments (id, order_id, customer_id, amount, status, transaction_id, error_message, processed_at)
         VALUES ($1, $2, $3, $4, 'FAILED', $5, $6, NOW())`,
        [uuidv4(), orderId, customerId, amount, transactionId, errorMessage]
      );

      logger.warn("Payment failed", { orderId, transactionId, errorMessage });

      return { transactionId, status: "FAILED", errorMessage };
    }
  } finally {
    client.release();
  }
}
