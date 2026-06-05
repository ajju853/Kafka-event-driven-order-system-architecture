import { createCounter } from "@kafka-order-system/shared";

export const auditEventsRecorded = createCounter("audit_events_total", "Total audit events recorded");
