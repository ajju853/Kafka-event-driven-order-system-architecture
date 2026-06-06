import { Pool } from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";
import { EventStore } from "@kafka-order-system/shared";

export const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  max: 10,
});

export const analyticsEventStore = new EventStore(pool, "analytics");

pool.on("error", (err) => {
  logger.error("Unexpected PostgreSQL pool error", { error: err.message });
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await analyticsEventStore.initializeSchema();
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_metrics (
        id UUID PRIMARY KEY,
        order_id UUID NOT NULL,
        customer_id UUID NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL,
        item_count INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_metrics_created
      ON order_metrics(created_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_metrics_status
      ON order_metrics(status)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_order_summary (
        date DATE PRIMARY KEY,
        total_orders INTEGER NOT NULL DEFAULT 0,
        total_revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
        cancelled_orders INTEGER NOT NULL DEFAULT 0,
        avg_order_value DECIMAL(10,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id VARCHAR(255) PRIMARY KEY,
        consumer_group VARCHAR(255) NOT NULL,
        processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    logger.info("Analytics database schema initialized");
  } catch (error) {
    logger.error("Failed to initialize analytics database", {
      error: (error as Error).message,
    });
    throw error;
  } finally {
    client.release();
  }
}
