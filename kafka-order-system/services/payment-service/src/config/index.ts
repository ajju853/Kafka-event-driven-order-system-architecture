export const config = {
  port: parseInt(process.env.PORT || "4006", 10),
  kafka: {
    broker: process.env.KAFKA_BROKER || "localhost:9092",
    clientId: "payment-service",
    groupId: "payment-service-group",
  },
  postgres: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    user: process.env.POSTGRES_USER || "orderuser",
    password: process.env.POSTGRES_PASSWORD || "orderpass",
    database: process.env.POSTGRES_DB || "paymentdb",
  },
  otel: {
    serviceName: "payment-service",
    jaegerEndpoint: process.env.JAEGER_ENDPOINT || "http://jaeger:14250",
  },
};
