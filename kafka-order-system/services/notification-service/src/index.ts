import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { OrderEventConsumer } from "./consumers/order-consumer";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      service: "notification-service",
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  });

  const consumer = new OrderEventConsumer();
  await consumer.start();

  app.listen(config.port, () => {
    logger.info(`Notification service listening on port ${config.port}`);
  });

  const shutdown = async () => {
    logger.info("Shutting down notification service...");
    await consumer.stop();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  logger.error("Failed to start notification service", {
    error: (error as Error).message,
  });
  process.exit(1);
});
