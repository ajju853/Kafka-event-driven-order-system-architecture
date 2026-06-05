import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config";
import { initializeDatabase, pool } from "./models/db";
import { createKafkaProducer } from "./services/kafka-producer";
import { OutboxPublisher } from "./services/outbox-publisher";
import { OrderConsumer } from "./consumers/order-consumer";
import { errorHandler } from "./middleware/error-handler";
import { healthCheck } from "./controllers/health-controller";
import { rateLimiter } from "./middleware/rate-limiter";
import { optionalAuth } from "./middleware/auth";
import {
  createOrder,
  getOrder,
  listOrders,
  cancelOrder,
} from "./controllers/order-controller";
import { logger } from "./utils/logger";
import { initializeTracing } from "./utils/tracing";
import { getMetrics, getMetricsContentType } from "@kafka-order-system/shared";

async function main(): Promise<void> {
  initializeTracing();

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(rateLimiter);
  app.use(optionalAuth);
  app.use(
    morgan("combined", {
      stream: { write: (msg) => logger.info(msg.trim()) },
    })
  );

  app.get("/health", healthCheck);
  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", getMetricsContentType());
    res.send(await getMetrics());
  });

  app.post("/api/orders", createOrder);
  app.get("/api/orders", listOrders);
  app.get("/api/orders/:id", getOrder);
  app.post("/api/orders/:id/cancel", cancelOrder);

  app.use(errorHandler);

  await initializeDatabase();

  await createKafkaProducer();

  const orderConsumer = new OrderConsumer(pool);
  await orderConsumer.start();

  const outboxPublisher = new OutboxPublisher();
  await outboxPublisher.start();

  app.listen(config.port, () => {
    logger.info(`Order service listening on port ${config.port}`);
  });

  const shutdown = async () => {
    logger.info("Shutting down order service...");
    await outboxPublisher.stop();
    const { disconnectProducer } = await import("./services/kafka-producer");
    await disconnectProducer();
    const { pool } = await import("./models/db");
    await pool.end();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  logger.error("Failed to start order service", {
    error: (error as Error).message,
  });
  process.exit(1);
});
