const API_GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:4001";
const QUERY_GATEWAY = process.env.NEXT_PUBLIC_QUERY_GATEWAY || "http://localhost:4008";

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
  baseUrl?: string
): Promise<T> {
  const url = `${baseUrl || API_GATEWAY}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: `HTTP ${response.status}`,
    }));
    throw new Error(error.error || "API request failed");
  }

  return response.json();
}

export interface Order {
  id: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  status: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderRequest {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export const api = {
  orders: {
    create: (data: CreateOrderRequest) =>
      fetchApi<{ success: boolean; data: { orderId: string; status: string } }>(
        "/api/orders",
        { method: "POST", body: JSON.stringify(data) }
      ),
    list: (params?: { customerId?: string; status?: string; page?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.customerId) searchParams.set("customerId", params.customerId);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.page) searchParams.set("page", params.page.toString());
      const qs = searchParams.toString();
      return fetchApi<{ success: boolean; data: Order[]; total: number }>(
        `/api/orders${qs ? `?${qs}` : ""}`,
        undefined,
        QUERY_GATEWAY
      );
    },
    get: (id: string) =>
      fetchApi<{ success: boolean; data: Order }>(
        `/api/orders/${id}`,
        undefined,
        QUERY_GATEWAY
      ),
    cancel: (id: string, reason?: string) =>
      fetchApi<{ success: boolean; data: { orderId: string; status: string } }>(
        `/api/orders/${id}/cancel`,
        { method: "POST", body: JSON.stringify({ reason }) }
      ),
  },
  inventory: {
    get: (productId: string) =>
      fetchApi<{ success: boolean; data: { available: number } }>(
        `/api/inventory/${productId}`
      ),
  },
  analytics: {
    dashboard: () =>
      fetchApi<{ success: boolean; data: any }>("/api/analytics/dashboard"),
    daily: (days = 7) =>
      fetchApi<{ success: boolean; data: any[] }>(
        `/api/analytics/daily?days=${days}`
      ),
  },
  audit: {
    logs: (params?: { eventType?: string; aggregateId?: string; page?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.eventType) searchParams.set("eventType", params.eventType);
      if (params?.aggregateId) searchParams.set("aggregateId", params.aggregateId);
      if (params?.page) searchParams.set("page", params.page.toString());
      const qs = searchParams.toString();
      return fetchApi<{ success: boolean; data: any[] }>(
        `/api/audit/logs${qs ? `?${qs}` : ""}`
      );
    },
  },
};
