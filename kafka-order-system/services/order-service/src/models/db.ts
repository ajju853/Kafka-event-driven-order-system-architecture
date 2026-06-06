import { Pool } from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";
import { orderEventStore } from "../services/event-sourcing";

export const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  logger.error("Unexpected PostgreSQL pool error", { error: err.message });
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await orderEventStore.initializeSchema();

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY,
        customer_id UUID NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        total_amount DECIMAL(12,2) NOT NULL,
        shipping_address JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY,
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID NOT NULL,
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS outbox_events (
        id UUID PRIMARY KEY,
        aggregate_type VARCHAR(100) NOT NULL,
        aggregate_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        published_at TIMESTAMP WITH TIME ZONE,
        retry_count INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_outbox_events_status ON outbox_events(status, created_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id VARCHAR(255) PRIMARY KEY,
        consumer_group VARCHAR(255) NOT NULL,
        processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_processed_events_consumer
      ON processed_events(consumer_group, processed_at)
    `);

    await client.query("COMMIT");
    logger.info("Database schema initialized successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Failed to initialize database schema", {
      error: (error as Error).message,
    });
    throw error;
  } finally {
    client.release();
  }
}
