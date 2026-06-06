import { randomUUID } from "crypto";
import { pool } from "../models/db";
import { EventStore, DomainEvent } from "@kafka-order-system/shared";

export const inventoryEventStore = new EventStore(pool, "inventory");

export function buildStockReservedEvent(
  orderId: string,
  items: { productId: string; quantity: number }[]
): DomainEvent {
  return {
    eventId: randomUUID(),
    aggregateId: orderId,
    aggregateType: "inventory",
    eventType: "StockReserved",
    version: 1,
    timestamp: new Date(),
    payload: { orderId, items, success: true },
  };
}

export function buildStockReservationFailedEvent(
  orderId: string,
  failures: { productId: string; available: number; requested: number }[]
): DomainEvent {
  return {
    eventId: randomUUID(),
    aggregateId: orderId,
    aggregateType: "inventory",
    eventType: "StockReservationFailed",
    version: 1,
    timestamp: new Date(),
    payload: { orderId, failures, success: false },
  };
}

export function buildStockReleasedEvent(
  orderId: string,
  items: { productId: string; quantity: number }[],
  reason: string
): DomainEvent {
  return {
    eventId: randomUUID(),
    aggregateId: orderId,
    aggregateType: "inventory",
    eventType: "StockReleased",
    version: 1,
    timestamp: new Date(),
    payload: { orderId, items, reason },
  };
}
