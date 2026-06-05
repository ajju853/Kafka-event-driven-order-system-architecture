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
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        product_id UUID PRIMARY KEY,
        quantity INTEGER NOT NULL DEFAULT 0,
        reserved INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_reservations (
        id UUID PRIMARY KEY,
        order_id UUID NOT NULL,
        product_id UUID NOT NULL,
        quantity INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'RESERVED',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order
      ON inventory_reservations(order_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id VARCHAR(255) PRIMARY KEY,
        consumer_group VARCHAR(255) NOT NULL,
        processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    const existing = await client.query(
      "SELECT COUNT(*) FROM inventory"
    );
    if (parseInt(existing.rows[0].count, 10) === 0) {
      const seedData = [
        { productId: "11111111-1111-1111-1111-111111111001", quantity: 100 },
        { productId: "11111111-1111-1111-1111-111111111002", quantity: 50 },
        { productId: "11111111-1111-1111-1111-111111111003", quantity: 200 },
        { productId: "11111111-1111-1111-1111-111111111004", quantity: 75 },
        { productId: "11111111-1111-1111-1111-111111111005", quantity: 150 },
      ];
      for (const item of seedData) {
        await client.query(
          `INSERT INTO inventory (product_id, quantity) VALUES ($1, $2)`,
          [item.productId, item.quantity]
        );
      }
      logger.info("Seeded inventory data");
    }

    logger.info("Inventory database schema initialized");
  } catch (error) {
    logger.error("Failed to initialize inventory database", {
      error: (error as Error).message,
    });
    throw error;
  } finally {
    client.release();
  }
}
