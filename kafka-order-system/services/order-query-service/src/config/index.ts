export const config = {
  port: parseInt(process.env.PORT || "4008", 10),
  kafka: {
    broker: process.env.KAFKA_BROKER || "localhost:9092",
    clientId: "order-query-service",
    groupId: "order-query-group",
  },
  postgres: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    user: process.env.POSTGRES_USER || "orderuser",
    password: process.env.POSTGRES_PASSWORD || "orderpass",
    database: process.env.POSTGRES_DB || "orderdb",
  },
};
