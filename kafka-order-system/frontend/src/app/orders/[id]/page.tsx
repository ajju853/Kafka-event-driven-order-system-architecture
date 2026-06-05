"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useOrder } from "../../../hooks/useOrders";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CREATED: "bg-blue-100 text-blue-800",
  PAYMENT_PROCESSED: "bg-green-100 text-green-800",
  PAYMENT_FAILED: "bg-red-100 text-red-800",
  INVENTORY_RESERVED: "bg-purple-100 text-purple-800",
  INVENTORY_FAILED: "bg-orange-100 text-orange-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { order, loading, error } = useOrder(id);

  if (loading) return <div className="p-8 text-center">Loading order...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!order) return <div className="p-8 text-center">Order not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link href="/orders" className="text-blue-600 hover:underline mb-4 inline-block">
        &larr; Back to Orders
      </Link>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold">Order {order.id?.slice(0, 8)}</h1>
            <p className="text-gray-500 text-sm mt-1">
              Placed on {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[order.status] || "bg-gray-100"}`}>
            {order.status}
          </span>
        </div>

        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold mb-2">Items</h2>
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-500 text-sm">
                <th className="pb-2">Product</th>
                <th className="pb-2">Qty</th>
                <th className="pb-2 text-right">Price</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="py-2">{item.name || item.productId?.slice(0, 8)}</td>
                  <td className="py-2">{item.quantity}</td>
                  <td className="py-2 text-right">${item.price.toFixed(2)}</td>
                  <td className="py-2 text-right">${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-bold">
                <td colSpan={3} className="py-2 text-right">Total</td>
                <td className="py-2 text-right">${order.totalAmount?.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {order.shippingAddress && (
          <div className="border-t pt-4 mt-4">
            <h2 className="text-lg font-semibold mb-2">Shipping Address</h2>
            <p className="text-gray-600">
              {(order.shippingAddress as any).street}<br />
              {(order.shippingAddress as any).city}, {(order.shippingAddress as any).state} {(order.shippingAddress as any).zip}<br />
              {(order.shippingAddress as any).country}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
