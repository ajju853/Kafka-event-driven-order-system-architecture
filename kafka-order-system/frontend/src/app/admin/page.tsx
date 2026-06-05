"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Activity, AlertTriangle, Monitor } from "lucide-react";

export default function Admin() {
  const { data: analyticsData } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api.analytics.dashboard(),
  });

  const { data: auditData } = useQuery({
    queryKey: ["audit-stats"],
    queryFn: () => api.audit.logs({ page: 1 }),
  });

  const analytics = analyticsData?.data;
  const auditLogs = auditData?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System monitoring and management
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Revenue
            </CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(analytics?.totalRevenue || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Events Processed
            </CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditLogs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Kafka Topics
            </CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7</div>
            <p className="text-xs text-muted-foreground">
              order-created, order-cancelled, inventory-reserved, ...
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Services
            </CardTitle>
            <Monitor className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-green-600">All operational</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Order Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.orderBreakdown?.length > 0 ? (
              <div className="space-y-2">
                {analytics.orderBreakdown.map((item: any) => (
                  <div
                    key={item.status}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{item.status}</span>
                    <Badge>{item.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No order data available
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Audit Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {auditLogs.slice(0, 10).map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                >
                  <div>
                    <Badge variant="info" className="mr-2">
                      {log.event_type}
                    </Badge>
                    <span className="font-mono text-xs">
                      {log.event_id?.slice(0, 8)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.ingested_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No audit events yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Architecture</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {[
              "Order Service",
              "Inventory Service",
              "Notification Service",
              "Analytics Service",
              "Audit Service",
              "Kafka",
              "PostgreSQL",
              "Redis",
              "Schema Registry",
            ].map((service) => (
              <Badge key={service} variant="secondary" className="px-3 py-1">
                {service}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Event-driven microservices architecture with Kafka as the central
            event bus. Services communicate asynchronously through events,
            ensuring loose coupling and fault tolerance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
