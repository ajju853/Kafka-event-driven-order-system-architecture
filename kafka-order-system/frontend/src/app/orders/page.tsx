"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Package } from "lucide-react";

export default function Orders() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.orders.list({ page: 1 }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading orders...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Card>
          <CardContent className="py-12 text-center text-destructive">
            Failed to load orders: {(error as Error).message}
          </CardContent>
        </Card>
      </div>
    );
  }

  const orders = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">
            {data?.total || 0} total orders
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No orders yet</p>
            <p className="text-muted-foreground mb-4">
              Place your first order to get started
            </p>
            <Link href="/checkout">
              <Button>Place Order</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Order ID</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Items</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 font-mono text-xs">
                        {order.id.slice(0, 8)}
                      </td>
                      <td className="py-3 font-mono text-xs text-muted-foreground">
                        {order.customerId.slice(0, 8)}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            order.status === "CANCELLED"
                              ? "destructive"
                              : order.status === "CREATED"
                              ? "success"
                              : "info"
                          }
                        >
                          {order.status}
                        </Badge>
                      </td>
                      <td className="py-3">{order.items.length}</td>
                      <td className="py-3 font-medium">
                        ${order.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <Link href={`/orders/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
