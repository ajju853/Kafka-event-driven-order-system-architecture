import { createCounter } from "@kafka-order-system/shared";

export const dlqEventsStored = createCounter("dlq_events_stored_total", "Total DLQ events stored");
export const dlqEventsReplayed = createCounter("dlq_events_replayed_total", "Total DLQ events replayed");
export const dlqReplayFailures = createCounter("dlq_replay_failures_total", "Total DLQ replay failures");
