import { config } from "../config";
import { logger } from "../utils/logger";

export async function sendSMS(
  phoneNumber: string,
  message: string
): Promise<void> {
  if (!config.sms.enabled) {
    logger.info("SMS disabled, skipping", { phoneNumber });
    return;
  }

  logger.info("Sending SMS", {
    provider: config.sms.provider,
    phoneNumber,
    messageLength: message.length,
  });

  await new Promise((resolve) => setTimeout(resolve, 50));
}

export async function sendOrderStatusNotification(
  phoneNumber: string,
  orderId: string,
  status: string
): Promise<void> {
  const message = `Your order ${orderId} is now: ${status}`;
  await sendSMS(phoneNumber, message);
  logger.info("Order status SMS sent", { orderId, phoneNumber, status });
}
