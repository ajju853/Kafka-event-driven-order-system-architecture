import { Pool } from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";
import { paymentEventStore } from "../services/event-sourcing";

export const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  max: 10,
});

pool.on("error", (err) => {
  logger.error("Unexpected PostgreSQL pool error", { error: err.message });
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await paymentEventStore.initializeSchema();
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY,
        order_id UUID NOT NULL,
        customer_id UUID NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        payment_method VARCHAR(50),
        transaction_id VARCHAR(255),
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP WITH TIME ZONE
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id VARCHAR(255) PRIMARY KEY,
        consumer_group VARCHAR(255) NOT NULL,
        processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    logger.info("Payment database schema initialized");
  } catch (error) {
    logger.error("Failed to initialize payment database", {
      error: (error as Error).message,
    });
    throw error;
  } finally {
    client.release();
  }
}
