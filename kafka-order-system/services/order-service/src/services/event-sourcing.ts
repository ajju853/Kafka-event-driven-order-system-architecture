import { randomUUID } from "crypto";
import { pool } from "../models/db";
import { logger } from "../utils/logger";
import { EventStore, DomainEvent, ORDER_STATUS } from "@kafka-order-system/shared";
import { eventStored } from "../metrics";

export const orderEventStore = new EventStore(pool, "order");

export function buildOrderCreatedEvent(
  orderId: string,
  customerId: string,
  items: { productId: string; quantity: number; price: number }[],
  totalAmount: number,
  shippingAddress: Record<string, unknown>
): DomainEvent {
  return {
    eventId: randomUUID(),
    aggregateId: orderId,
    aggregateType: "order",
    eventType: "OrderCreated",
    version: 1,
    timestamp: new Date(),
    payload: { orderId, customerId, items, totalAmount, shippingAddress },
  };
}

export function buildOrderCancelledEvent(
  orderId: string,
  customerId: string,
  reason?: string
): DomainEvent {
  return {
    eventId: randomUUID(),
    aggregateId: orderId,
    aggregateType: "order",
    eventType: "OrderCancelled",
    version: 1,
    timestamp: new Date(),
    payload: { orderId, customerId, reason },
  };
}

export function buildPaymentProcessedEvent(
  orderId: string,
  customerId: string,
  paymentId: string,
  amount: number
): DomainEvent {
  return {
    eventId: randomUUID(),
    aggregateId: orderId,
    aggregateType: "order",
    eventType: "PaymentProcessed",
    version: 1,
    timestamp: new Date(),
    payload: { orderId, customerId, paymentId, amount, status: "SUCCESS" },
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
    aggregateType: "order",
    eventType: "PaymentFailed",
    version: 1,
    timestamp: new Date(),
    payload: { orderId, customerId, paymentId, amount, errorMessage, status: "FAILED" },
  };
}

export function buildInventoryReservedEvent(
  orderId: string,
  items: { productId: string; quantity: number; reserved: boolean }[]
): DomainEvent {
  return {
    eventId: randomUUID(),
    aggregateId: orderId,
    aggregateType: "order",
    eventType: "InventoryReserved",
    version: 1,
    timestamp: new Date(),
    payload: { orderId, items },
  };
}

export async function appendOrderEvent(
  event: DomainEvent
): Promise<void> {
  await orderEventStore.append(event);
  eventStored.inc();
  logger.debug("Event appended to store", {
    eventId: event.eventId,
    eventType: event.eventType,
    aggregateId: event.aggregateId,
  });
}

export async function getOrderEvents(
  orderId: string
): Promise<import("@kafka-order-system/shared").StoredEvent[]> {
  return orderEventStore.getEvents(orderId);
}
