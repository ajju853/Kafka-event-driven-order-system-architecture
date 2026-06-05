import { NodeSDK } from "@opentelemetry/sdk-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { logger } from "./logger";

export function initializeTracing(): void {
  if (process.env.OTEL_ENABLED !== "true") {
    logger.info("Tracing disabled (set OTEL_ENABLED=true to enable)");
    return;
  }
  try {
    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: "order-service",
      }),
      traceExporter: new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || "http://localhost:14250",
      }),
    });
    sdk.start();
    logger.info("OpenTelemetry tracing initialized");
    process.on("SIGTERM", () => sdk.shutdown().catch(() => {}));
  } catch (error) {
    logger.warn("OpenTelemetry not available - tracing disabled", {
      error: (error as Error).message,
    });
  }
}
