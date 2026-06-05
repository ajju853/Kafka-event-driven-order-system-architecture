import { createCounter } from "@kafka-order-system/shared";

export const notificationsSent = createCounter("notifications_sent_total", "Total notifications sent");
