import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { initializeDatabase, pool } from "./models/db";
import { InventoryConsumer } from "./consumers/inventory-consumer";
import { logger } from "./utils/logger";

async function main() {
  logger.info("Starting payment service...");

  await initializeDatabase();

  const consumer = new InventoryConsumer();
  await consumer.start();

  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "healthy", service: "payment-service" });
    } catch {
      res.status(503).json({ status: "unhealthy" });
    }
  });

  app.get("/payments", async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM payments ORDER BY created_at DESC LIMIT 100"
      );
      res.json({ payments: result.rows });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/payments/:orderId", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM payments WHERE order_id = $1",
        [req.params.orderId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.json({ payment: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.listen(config.port, () => {
    logger.info(`Payment service listening on port ${config.port}`);
  });

  process.on("SIGTERM", async () => {
    logger.info("Shutting down payment service...");
    await consumer.shutdown();
    await pool.end();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    logger.info("Shutting down payment service...");
    await consumer.shutdown();
    await pool.end();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error("Failed to start payment service", {
    error: (error as Error).message,
  });
  process.exit(1);
});
