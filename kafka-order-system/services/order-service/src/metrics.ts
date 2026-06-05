import { createCounter, createHistogram } from "@kafka-order-system/shared";

export const ordersCreated = createCounter("created_total", "Total orders created");
export const ordersCancelled = createCounter("cancelled_total", "Total orders cancelled");
export const outboxPublished = createCounter("outbox_published_total", "Outbox events published to Kafka");
export const rateLimitHits = createCounter("rate_limit_hits_total", "Requests rejected by rate limiter");
export const orderProcessingDuration = createHistogram("processing_duration_seconds", "Order processing duration", [], [0.1, 0.5, 1, 2, 5]);
