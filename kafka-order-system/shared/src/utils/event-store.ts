import { randomUUID } from "crypto";
import { Pool, PoolClient } from "pg";
import { DomainEvent, StoredEvent } from "../events/domain-events";
import "../upcasters/order-created";
import { applyUpcasters } from "../upcasters/registry";

const SQL_CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS event_store (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL,
    payload JSONB NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )
`;

const SQL_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_event_store_aggregate ON event_store(aggregate_id)`,
  `CREATE INDEX IF NOT EXISTS idx_event_store_type ON event_store(event_type)`,
  `CREATE INDEX IF NOT EXISTS idx_event_store_created ON event_store(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_event_store_agg_type ON event_store(aggregate_type, aggregate_id)`,
];

export class EventStore {
  constructor(
    private pool: Pool,
    private aggregateType: string
  ) {}

  async initializeSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(SQL_CREATE_TABLE);
      for (const idx of SQL_INDEXES) {
        await client.query(idx);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async append(
    event: DomainEvent,
    client?: PoolClient
  ): Promise<void> {
    const q = client || this.pool;
    await q.query(
      `INSERT INTO event_store (id, event_id, aggregate_id, aggregate_type, event_type, version, payload, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        randomUUID(),
        event.eventId,
        event.aggregateId,
        event.aggregateType,
        event.eventType,
        event.version,
        JSON.stringify(event.payload),
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.timestamp,
      ]
    );
  }

  async getEvents(aggregateId: string): Promise<StoredEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM event_store
       WHERE aggregate_type = $1 AND aggregate_id = $2
       ORDER BY version ASC`,
      [this.aggregateType, aggregateId]
    );
    return result.rows.map(mapAndUpcast);
  }

  async getEventsSince(since: Date): Promise<StoredEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM event_store
       WHERE aggregate_type = $1 AND timestamp >= $2
       ORDER BY timestamp ASC`,
      [this.aggregateType, since]
    );
    return result.rows.map(mapAndUpcast);
  }

  async getAllEvents(limit = 1000, offset = 0): Promise<StoredEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM event_store
       WHERE aggregate_type = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [this.aggregateType, limit, offset]
    );
    return result.rows.map(mapAndUpcast);
  }

  async count(): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FROM event_store WHERE aggregate_type = $1`,
      [this.aggregateType]
    );
    return parseInt(result.rows[0].count, 10);
  }
}

function mapAndUpcast(row: Record<string, unknown>): StoredEvent {
  return applyUpcasters(toStoredEvent(row));
}

function toStoredEvent(row: Record<string, unknown>): StoredEvent {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    aggregateId: row.aggregate_id as string,
    aggregateType: row.aggregate_type as string,
    eventType: row.event_type as string,
    version: row.version as number,
    payload: row.payload as Record<string, unknown>,
    metadata: row.metadata ? (row.metadata as Record<string, unknown>) : undefined,
    timestamp: row.timestamp as Date,
    createdAt: row.created_at as Date,
  };
}
