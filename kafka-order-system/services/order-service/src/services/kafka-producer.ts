import { Kafka, Producer } from "kafkajs";
import { config } from "../config";
import { logger } from "../utils/logger";

let producer: Producer;

export async function createKafkaProducer(): Promise<Producer> {
  const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: [config.kafka.broker],
    retry: {
      initialRetryTime: 300,
      retries: 10,
    },
  });

  producer = kafka.producer({
    transactionalId: "order-service-producer",
    maxInFlightRequests: 1,
    idempotent: true,
  });

  await producer.connect();
  logger.info("Kafka producer connected");

  producer.on("producer.disconnect", () => {
    logger.warn("Kafka producer disconnected");
  });

  return producer;
}

export function getProducer(): Producer {
  if (!producer) {
    throw new Error("Kafka producer not initialized");
  }
  return producer;
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    logger.info("Kafka producer disconnected");
  }
}
