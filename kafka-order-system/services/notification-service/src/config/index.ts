export const config = {
  port: parseInt(process.env.PORT || "4003", 10),
  kafka: {
    broker: process.env.KAFKA_BROKER || "localhost:9092",
    clientId: "notification-service",
    groupId: "notification-service-group",
  },
  postgres: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    user: process.env.POSTGRES_USER || "orderuser",
    password: process.env.POSTGRES_PASSWORD || "orderpass",
    database: process.env.POSTGRES_DB || "notificationdb",
  },
  email: {
    enabled: process.env.EMAIL_ENABLED === "true",
    fromAddress: process.env.EMAIL_FROM || "orders@example.com",
  },
  sms: {
    enabled: process.env.SMS_ENABLED === "true",
    provider: process.env.SMS_PROVIDER || "mock",
  },
};
