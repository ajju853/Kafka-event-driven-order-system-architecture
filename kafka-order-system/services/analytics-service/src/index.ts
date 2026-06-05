import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { initializeDatabase } from "./models/db";
import { AnalyticsConsumer } from "./consumers/order-consumer";
import {
  getDashboardMetrics,
  getDailySummary,
} from "./controllers/analytics-controller";
import { logger } from "./utils/logger";
import { getMetrics, getMetricsContentType } from "@kafka-order-system/shared";

async function main(): Promise<void> {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", getMetricsContentType());
    res.send(await getMetrics());
  });
  app.get("/health", (_req, res) => {
    res.json({
      service: "analytics-service",
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/analytics/dashboard", getDashboardMetrics);
  app.get("/api/analytics/daily", getDailySummary);

  await initializeDatabase();

  const consumer = new AnalyticsConsumer();
  await consumer.start();

  app.listen(config.port, () => {
    logger.info(`Analytics service listening on port ${config.port}`);
  });

  const shutdown = async () => {
    logger.info("Shutting down analytics service...");
    await consumer.stop();
    await (await import("./models/db")).pool.end();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  logger.error("Failed to start analytics service", {
    error: (error as Error).message,
  });
  process.exit(1);
});
