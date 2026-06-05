"use client";

import { useDispatch } from "react-redux";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { addItem } from "@/store";
import { ShoppingCart } from "lucide-react";

const products = [
  { id: "11111111-1111-1111-1111-111111111001", name: "Wireless Mouse", price: 29.99 },
  { id: "11111111-1111-1111-1111-111111111002", name: "Mechanical Keyboard", price: 89.99 },
  { id: "11111111-1111-1111-1111-111111111003", name: "USB-C Hub", price: 49.99 },
  { id: "11111111-1111-1111-1111-111111111004", name: "Monitor Stand", price: 39.99 },
  { id: "11111111-1111-1111-1111-111111111005", name: "Webcam HD", price: 69.99 },
];

export default function Products() {
  const dispatch = useDispatch();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Products</h1>
        <p className="text-muted-foreground">Browse and add products to your cart</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id}>
            <CardHeader>
              <CardTitle className="text-lg">{product.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${product.price.toFixed(2)}</p>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() =>
                  dispatch(
                    addItem({
                      productId: product.id,
                      name: product.name,
                      quantity: 1,
                      price: product.price,
                    })
                  )
                }
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Add to Cart
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
