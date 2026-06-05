import { initializeTracing as init } from "@kafka-order-system/shared";

export function initializeTracing(): void {
  init("payment-service");
}
