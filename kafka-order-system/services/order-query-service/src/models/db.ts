import { Pool } from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";

export const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  max: 20,
});

pool.on("error", (err) => {
  logger.error("Unexpected PostgreSQL pool error", { error: err.message });
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_summary (
        order_id UUID PRIMARY KEY,
        customer_id UUID NOT NULL,
        status VARCHAR(50) NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        item_count INTEGER NOT NULL DEFAULT 0,
        shipping_address JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
        payment_status VARCHAR(50),
        inventory_status VARCHAR(50)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_orders (
        customer_id UUID NOT NULL,
        order_id UUID NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        PRIMARY KEY (customer_id, order_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_orders_customer
      ON customer_orders(customer_id, created_at DESC)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_timeline (
        id UUID PRIMARY KEY,
        order_id UUID NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        version INTEGER NOT NULL,
        payload JSONB NOT NULL,
        occurred_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_timeline_order
      ON order_timeline(order_id, occurred_at ASC)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id VARCHAR(255) PRIMARY KEY,
        consumer_group VARCHAR(255) NOT NULL,
        processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query("COMMIT");
    logger.info("Query database schema initialized");
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Failed to initialize query database", {
      error: (error as Error).message,
    });
    throw error;
  } finally {
    client.release();
  }
}
