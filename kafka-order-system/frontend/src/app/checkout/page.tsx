"use client";

import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, clearCart, setCustomerId } from "@/store";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export default function Checkout() {
  const { items, customerId } = useSelector(
    (state: RootState) => state.cart
  );
  const dispatch = useDispatch();
  const router = useRouter();

  const [localCustomerId, setLocalCustomerId] = useState(
    customerId || localStorage.getItem("customerId") || uuidv4()
  );
  const [shippingAddress] = useState({
    street: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
    country: "US",
  });

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const orderMutation = useMutation({
    mutationFn: () =>
      api.orders.create({
        customerId: localCustomerId,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
        shippingAddress,
      }),
    onSuccess: (data) => {
      dispatch(setCustomerId(localCustomerId));
      localStorage.setItem("customerId", localCustomerId);
      dispatch(clearCart());
      router.push(`/orders/${data.data.orderId}`);
    },
  });

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium mb-2">
              Your cart is empty
            </p>
            <p className="text-muted-foreground">
              Add items to your cart before checking out
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex justify-between text-sm"
                >
                  <span>
                    {item.name} x{item.quantity}
                  </span>
                  <span className="font-medium">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{shippingAddress.street}</p>
              <p className="text-sm">
                {shippingAddress.city}, {shippingAddress.state}{" "}
                {shippingAddress.zip}
              </p>
              <p className="text-sm">{shippingAddress.country}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Customer ID
              </label>
              <p className="text-sm font-mono text-muted-foreground mt-1">
                {localCustomerId}
              </p>
            </div>

            <Badge variant="info">
              {items.length} items - ${total.toFixed(2)}
            </Badge>

            <Button
              className="w-full"
              size="lg"
              onClick={() => orderMutation.mutate()}
              disabled={orderMutation.isPending}
            >
              {orderMutation.isPending
                ? "Creating Order..."
                : "Place Order"}
            </Button>

            {orderMutation.isError && (
              <p className="text-sm text-destructive mt-2">
                {orderMutation.error.message}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
