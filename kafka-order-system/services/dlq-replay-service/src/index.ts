import express from "express";
import cors from "cors";
import helmet from "helmet";
import { Pool } from "pg";
import { config } from "./config";
import { DLQConsumer } from "./services/dlq-consumer";
import { DLQReplayService } from "./services/dlq-replay";
import { createDLQController } from "./controllers/dlq-controller";
import { logger } from "./utils/logger";
import { getMetrics, getMetricsContentType } from "@kafka-order-system/shared";

async function main() {
  logger.info("Starting DLQ replay service...");

  const pool = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    user: config.postgres.user,
    password: config.postgres.password,
    database: config.postgres.database,
    max: 10,
  });

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS dlq_events (
        event_id VARCHAR(255) PRIMARY KEY,
        original_payload TEXT NOT NULL,
        error_message TEXT,
        consumer_group VARCHAR(255) NOT NULL,
        source_topic VARCHAR(255) NOT NULL,
        failed_at TIMESTAMP WITH TIME ZONE,
        replayed BOOLEAN DEFAULT FALSE,
        replayed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    logger.info("DLQ database schema initialized");
  } finally {
    client.release();
  }

  const dlqConsumer = new DLQConsumer(pool);
  await dlqConsumer.start();

  const replayService = new DLQReplayService(pool);
  await replayService.connect();
  const controller = createDLQController(replayService);

  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", getMetricsContentType());
    res.send(await getMetrics());
  });
  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "healthy", service: "dlq-replay-service" });
    } catch {
      res.status(503).json({ status: "unhealthy" });
    }
  });

  app.get("/dlq/events", controller.listEvents);
  app.get("/dlq/events/:eventId", controller.getEvent);
  app.post("/dlq/replay/:eventId", controller.replayEvent);
  app.post("/dlq/replay-all", controller.replayAll);

  app.listen(config.port, () => {
    logger.info(`DLQ replay service listening on port ${config.port}`);
  });

  process.on("SIGTERM", async () => {
    logger.info("Shutting down DLQ replay service...");
    await dlqConsumer.shutdown();
    await replayService.shutdown();
    await pool.end();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    logger.info("Shutting down DLQ replay service...");
    await dlqConsumer.shutdown();
    await replayService.shutdown();
    await pool.end();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error("Failed to start DLQ replay service", {
    error: (error as Error).message,
  });
  process.exit(1);
});
