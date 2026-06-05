"use client";

import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { removeItem, updateQuantity } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Trash2, Minus, Plus, ShoppingBag } from "lucide-react";

export default function Cart() {
  const { items } = useSelector((state: RootState) => state.cart);
  const dispatch = useDispatch();

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Shopping Cart</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingBag className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Your cart is empty</p>
            <p className="text-muted-foreground mb-4">
              Add some products to get started
            </p>
            <Link href="/products">
              <Button>Browse Products</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shopping Cart</h1>
          <p className="text-muted-foreground">{items.length} items</p>
        </div>
        <Badge variant="info" className="text-lg px-4 py-2">
          Total: ${total.toFixed(2)}
        </Badge>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.productId}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <h3 className="font-medium">{item.name}</h3>
                <p className="text-sm text-muted-foreground">
                  ${item.price.toFixed(2)} each
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      dispatch(
                        updateQuantity({
                          productId: item.productId,
                          quantity: Math.max(1, item.quantity - 1),
                        })
                      )
                    }
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      dispatch(
                        updateQuantity({
                          productId: item.productId,
                          quantity: item.quantity + 1,
                        })
                      )
                    }
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

                <p className="font-medium w-20 text-right">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => dispatch(removeItem(item.productId))}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Link href="/checkout">
          <Button size="lg">
            Proceed to Checkout
          </Button>
        </Link>
      </div>
    </div>
  );
}
