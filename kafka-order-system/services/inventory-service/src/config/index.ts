export const config = {
  port: parseInt(process.env.PORT || "4002", 10),
  kafka: {
    broker: process.env.KAFKA_BROKER || "localhost:9092",
    clientId: "inventory-service",
    groupId: "inventory-service-group",
  },
  postgres: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    user: process.env.POSTGRES_USER || "orderuser",
    password: process.env.POSTGRES_PASSWORD || "orderpass",
    database: process.env.POSTGRES_DB || "inventorydb",
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  },
};
