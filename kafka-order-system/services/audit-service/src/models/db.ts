import { Pool } from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";

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
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_audit_log (
        id UUID PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        aggregate_id VARCHAR(255),
        aggregate_type VARCHAR(100),
        payload JSONB NOT NULL,
        source_service VARCHAR(100),
        topic VARCHAR(100),
        partition INTEGER,
        offset BIGINT,
        ingested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_event_id ON event_audit_log(event_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_event_type ON event_audit_log(event_type)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_aggregate ON event_audit_log(aggregate_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_ingested ON event_audit_log(ingested_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id VARCHAR(255) PRIMARY KEY,
        consumer_group VARCHAR(255) NOT NULL,
        processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    logger.info("Audit database schema initialized");
  } catch (error) {
    logger.error("Failed to initialize audit database", {
      error: (error as Error).message,
    });
    throw error;
  } finally {
    client.release();
  }
}
