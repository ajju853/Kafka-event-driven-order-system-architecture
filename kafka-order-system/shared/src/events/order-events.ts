import { z } from "zod";

export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
});

export const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  country: z.string(),
});

export const CreateOrderEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("ORDER_CREATED"),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  items: z.array(OrderItemSchema),
  totalAmount: z.number().positive(),
  shippingAddress: AddressSchema,
  timestamp: z.string().datetime(),
  version: z.number().int().default(1),
});

export const CancelOrderEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("ORDER_CANCELLED"),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  reason: z.string().optional(),
  timestamp: z.string().datetime(),
  version: z.number().int().default(1),
});

export const PaymentProcessedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("PAYMENT_PROCESSED"),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  paymentId: z.string().uuid(),
  status: z.enum(["SUCCESS", "FAILED"]),
  amount: z.number().positive(),
  timestamp: z.string().datetime(),
  version: z.number().int().default(1),
});

export const InventoryReservedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("INVENTORY_RESERVED"),
  orderId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    reserved: z.boolean(),
  })),
  timestamp: z.string().datetime(),
  version: z.number().int().default(1),
});

export const InventoryFailedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("INVENTORY_FAILED"),
  orderId: z.string().uuid(),
  reason: z.string(),
  failedItems: z.array(z.object({
    productId: z.string().uuid(),
    available: z.number().int(),
    requested: z.number().int(),
  })),
  timestamp: z.string().datetime(),
  version: z.number().int().default(1),
});

export const InventoryReleaseEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("INVENTORY_RELEASE"),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })),
  reason: z.string(),
  timestamp: z.string().datetime(),
  version: z.number().int().default(1),
});

export const ShippingCreatedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("SHIPPING_CREATED"),
  orderId: z.string().uuid(),
  shippingId: z.string().uuid(),
  carrier: z.string(),
  trackingNumber: z.string(),
  estimatedDelivery: z.string().datetime(),
  timestamp: z.string().datetime(),
  version: z.number().int().default(1),
});

export const PaymentFailedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("PAYMENT_FAILED"),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  paymentId: z.string().uuid(),
  status: z.literal("FAILED"),
  amount: z.number().positive(),
  errorMessage: z.string(),
  timestamp: z.string().datetime(),
  version: z.number().int().default(1),
});

export const OrderEventSchema = z.discriminatedUnion("eventType", [
  CreateOrderEventSchema,
  CancelOrderEventSchema,
  PaymentProcessedEventSchema,
  PaymentFailedEventSchema,
  InventoryReservedEventSchema,
  InventoryReleaseEventSchema,
  InventoryFailedEventSchema,
  ShippingCreatedEventSchema,
]);

export type CreateOrderEvent = z.infer<typeof CreateOrderEventSchema>;
export type CancelOrderEvent = z.infer<typeof CancelOrderEventSchema>;
export type PaymentProcessedEvent = z.infer<typeof PaymentProcessedEventSchema>;
export type PaymentFailedEvent = z.infer<typeof PaymentFailedEventSchema>;
export type InventoryReservedEvent = z.infer<typeof InventoryReservedEventSchema>;
export type InventoryReleaseEvent = z.infer<typeof InventoryReleaseEventSchema>;
export type InventoryFailedEvent = z.infer<typeof InventoryFailedEventSchema>;
export type ShippingCreatedEvent = z.infer<typeof ShippingCreatedEventSchema>;
export type OrderEvent = z.infer<typeof OrderEventSchema>;

export const EVENT_TOPICS = {
  ORDER_CREATED: "order-created",
  ORDER_CANCELLED: "order-cancelled",
  PAYMENT_PROCESSED: "payment-processed",
  PAYMENT_FAILED: "payment-failed",
  INVENTORY_RESERVED: "inventory-reserved",
  INVENTORY_RELEASE: "inventory-release",
  INVENTORY_FAILED: "inventory-failed",
  SHIPPING_CREATED: "shipping-created",
  ORDER_DLQ: "order-dlq",
  DLQ_EVENTS: "dlq-events",
} as const;

export const ORDER_STATUS = {
  PENDING: "PENDING",
  CREATED: "CREATED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_PROCESSED: "PAYMENT_PROCESSED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  INVENTORY_RESERVED: "INVENTORY_RESERVED",
  INVENTORY_FAILED: "INVENTORY_FAILED",
  SHIPPING: "SHIPPING",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
