import Redis from "ioredis";
import { config } from "./index";
import { logger } from "../utils/logger";

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  lazyConnect: true,
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.error("Redis error", { error: err.message }));

export async function connectRedis(): Promise<void> {
  await redis.connect();
}

export async function getInventoryCache(
  productId: string
): Promise<number | null> {
  const val = await redis.get(`inventory:${productId}`);
  return val ? parseInt(val, 10) : null;
}

export async function setInventoryCache(
  productId: string,
  quantity: number
): Promise<void> {
  await redis.set(`inventory:${productId}`, quantity.toString());
}

export async function decrementInventoryCache(
  productId: string,
  quantity: number
): Promise<number | null> {
  const val = await redis.decrby(`inventory:${productId}`, quantity);
  return val;
}
