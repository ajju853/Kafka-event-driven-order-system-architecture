export const config = {
  port: parseInt(process.env.PORT || "4001", 10),
  kafka: {
    broker: process.env.KAFKA_BROKER || "localhost:9092",
    clientId: "order-service",
    groupId: "order-service-group",
  },
  postgres: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    user: process.env.POSTGRES_USER || "orderuser",
    password: process.env.POSTGRES_PASSWORD || "orderpass",
    database: process.env.POSTGRES_DB || "orderdb",
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  },
  outbox: {
    pollIntervalMs: 1000,
    batchSize: 100,
  },
  retry: {
    maxRetries: 3,
    initialBackoffMs: 5000,
    backoffMultiplier: 3,
  },
};
