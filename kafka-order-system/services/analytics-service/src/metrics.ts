import { createCounter } from "@kafka-order-system/shared";

export const metricsRecorded = createCounter("analytics_events_total", "Total analytics events recorded");
