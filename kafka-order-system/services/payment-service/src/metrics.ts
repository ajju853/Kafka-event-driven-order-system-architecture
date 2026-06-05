import { createCounter, createHistogram } from "@kafka-order-system/shared";

export const paymentsProcessed = createCounter("payments_processed_total", "Total successful payments");
export const paymentsFailed = createCounter("payments_failed_total", "Total failed payments");
export const paymentDuration = createHistogram("payment_duration_seconds", "Payment processing duration", [], [0.1, 0.2, 0.5, 1, 2]);
