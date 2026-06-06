import { randomUUID } from "crypto";
import { pool } from "../models/db";
import { EventStore, DomainEvent } from "@kafka-order-system/shared";

export const paymentEventStore = new EventStore(pool, "payment");

export function buildPaymentProcessedEvent(
  orderId: string,
  customerId: string,
  paymentId: string,
  transactionId: string,
  amount: number
): DomainEvent {
  return {
    eventId: randomUUID(),
    aggregateId: orderId,
    aggregateType: "payment",
    eventType: "PaymentProcessed",
    version: 1,
    timestamp: new Date(),
    payload: { orderId, customerId, paymentId, transactionId, amount, status: "SUCCESS" },
  };
}

export function buildPaymentFailedEvent(
  orderId: string,
  customerId: string,
  paymentId: string,
  amount: number,
  errorMessage: string
): DomainEvent {
  return {
    eventId: randomUUID(),
    aggregateId: orderId,
    aggregateType: "payment",
    eventType: "PaymentFailed",
    version: 1,
    timestamp: new Date(),
    payload: { orderId, customerId, paymentId, amount, errorMessage, status: "FAILED" },
  };
}
