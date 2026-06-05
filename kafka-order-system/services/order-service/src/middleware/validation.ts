import { z } from "zod";

export const CreateOrderRequestSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID format"),
  items: z
    .array(
      z.object({
        productId: z.string().uuid("Invalid product ID format"),
        quantity: z.number().int().positive("Quantity must be positive"),
      })
    )
    .min(1, "At least one item is required"),
  shippingAddress: z.object({
    street: z.string().min(1, "Street is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    zip: z.string().min(1, "Zip code is required"),
    country: z.string().min(1, "Country is required"),
  }),
});

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
