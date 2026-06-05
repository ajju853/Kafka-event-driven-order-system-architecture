import { logger } from "../utils/logger";

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string
): Promise<void> {
  logger.info("Sending push notification", {
    userId,
    title,
    bodyLength: body.length,
  });

  await new Promise((resolve) => setTimeout(resolve, 50));
}

export async function sendOrderPushNotification(
  userId: string,
  orderId: string,
  status: string
): Promise<void> {
  const title = "Order Update";
  const body = `Your order ${orderId.slice(0, 8)}... is now: ${status}`;
  await sendPushNotification(userId, title, body);
  logger.info("Order push notification sent", { userId, orderId, status });
}
