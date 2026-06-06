import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { initializeDatabase } from "./models/db";
import { AuditConsumer } from "./consumers/audit-consumer";
import { getAuditLogs, getAuditStats } from "./controllers/audit-controller";
import { logger } from "./utils/logger";
import { getMetrics, getMetricsContentType, initializeTracing, shutdownTracing } from "@kafka-order-system/shared";
import adminRouter from "./controllers/admin-controller";

async function main(): Promise<void> {
  initializeTracing("audit-service");
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
      service: "audit-service",
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/audit/logs", getAuditLogs);
  app.get("/api/audit/stats", getAuditStats);

  app.use("/admin", adminRouter);

  await initializeDatabase();

  const consumer = new AuditConsumer();
  await consumer.start();

  app.listen(config.port, () => {
    logger.info(`Audit service listening on port ${config.port}`);
  });

  const shutdown = async () => {
    logger.info("Shutting down audit service...");
    await consumer.stop();
    await (await import("./models/db")).pool.end();
    await shutdownTracing();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  logger.error("Failed to start audit service", {
    error: (error as Error).message,
  });
  process.exit(1);
});
