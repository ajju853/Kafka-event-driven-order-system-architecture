import { createCounter } from "@kafka-order-system/shared";
export const eventsProjected = createCounter("query_events_projected_total", "Events projected into query read models");
