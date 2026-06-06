import { v4 as uuidv4 } from "uuid";
import { pool } from "../models/db";
import { logger } from "../utils/logger";
import { paymentsProcessed, paymentsFailed, paymentDuration } from "../metrics";
import {
  buildPaymentProcessedEvent,
  buildPaymentFailedEvent,
  paymentEventStore,
} from "./event-sourcing";
import { projectPaymentEvent } from "../projections/payment-projection";

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

  const startTime = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 200));

  const isSuccess = Math.random() < PAYMENT_SUCCESS_RATE;
  const transactionId = `txn_${uuidv4().replace(/-/g, "").slice(0, 16)}`;

  const client = await pool.connect();
  try {
    if (isSuccess) {
      const event = buildPaymentProcessedEvent(
        orderId, customerId, uuidv4(), transactionId, amount
      );

      await paymentEventStore.append(event);
      await projectPaymentEvent(client, event);

      paymentsProcessed.inc();
      paymentDuration.observe((Date.now() - startTime) / 1000);
      logger.info("Payment processed via event sourcing", { orderId, transactionId, eventId: event.eventId });

      return { transactionId, status: "SUCCESS" };
    } else {
      const errorMessage = "Payment declined: insufficient funds";
      const event = buildPaymentFailedEvent(
        orderId, customerId, uuidv4(), amount, errorMessage
      );

      await paymentEventStore.append(event);
      await projectPaymentEvent(client, event);

      paymentsFailed.inc();
      paymentDuration.observe((Date.now() - startTime) / 1000);
      logger.warn("Payment failed via event sourcing", { orderId, transactionId, errorMessage, eventId: event.eventId });

      return { transactionId, status: "FAILED", errorMessage };
    }
  } finally {
    client.release();
  }
}
