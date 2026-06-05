export const config = {
  port: parseInt(process.env.PORT || "4003", 10),
  kafka: {
    broker: process.env.KAFKA_BROKER || "localhost:9092",
    clientId: "notification-service",
    groupId: "notification-service-group",
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
