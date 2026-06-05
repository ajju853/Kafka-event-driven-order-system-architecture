import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { config } from "../config";
import { logger } from "./logger";

export function initializeTracing(): void {
  try {
    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: config.otel.serviceName,
      }),
      traceExporter: new JaegerExporter({
        endpoint: config.otel.jaegerEndpoint,
      }),
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start();
    logger.info("OpenTelemetry tracing initialized", {
      service: config.otel.serviceName,
      jaegerEndpoint: config.otel.jaegerEndpoint,
    });

    process.on("SIGTERM", () => {
      sdk
        .shutdown()
        .catch((err) =>
          logger.error("Error shutting down tracer", { error: err.message })
        );
    });
  } catch (error) {
    logger.warn("Failed to initialize tracing (non-fatal)", {
      error: (error as Error).message,
    });
  }
}
