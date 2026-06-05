import client from "prom-client";

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const register = registry;

export function createCounter(name: string, help: string, labelNames?: string[]) {
  return new client.Counter({
    name: `kafka_orders_${name}`,
    help,
    labelNames,
    registers: [registry],
  });
}

export function createGauge(name: string, help: string, labelNames?: string[]) {
  return new client.Gauge({
    name: `kafka_orders_${name}`,
    help,
    labelNames,
    registers: [registry],
  });
}

export function createHistogram(name: string, help: string, labelNames?: string[], buckets?: number[]) {
  return new client.Histogram({
    name: `kafka_orders_${name}`,
    help,
    labelNames,
    buckets,
    registers: [registry],
  });
}

export async function getMetrics(): Promise<string> {
  return registry.metrics();
}

export function getMetricsContentType(): string {
  return registry.contentType;
}
