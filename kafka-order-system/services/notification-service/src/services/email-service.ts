import { config } from "../config";
import { logger } from "../utils/logger";

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  if (!config.email.enabled) {
    logger.info("Email disabled, skipping", { to, subject });
    return;
  }

  logger.info("Sending email", {
    from: config.email.fromAddress,
    to,
    subject,
    bodyLength: body.length,
  });

  await new Promise((resolve) => setTimeout(resolve, 100));
}

export async function sendOrderConfirmation(
  email: string,
  orderId: string,
  customerName: string
): Promise<void> {
  const subject = `Order Confirmed - ${orderId}`;
  const body = `
    Dear ${customerName},

    Your order ${orderId} has been confirmed successfully.

    Thank you for your purchase!

    Best regards,
    The Order Team
  `;

  await sendEmail(email, subject, body);
  logger.info("Order confirmation email sent", { orderId, email });
}

export async function sendOrderCancellation(
  email: string,
  orderId: string
): Promise<void> {
  const subject = `Order Cancelled - ${orderId}`;
  const body = `
    Dear Customer,

    Your order ${orderId} has been cancelled.

    If you did not request this cancellation, please contact support.

    Best regards,
    The Order Team
  `;

  await sendEmail(email, subject, body);
  logger.info("Order cancellation email sent", { orderId, email });
}
