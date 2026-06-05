import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";
import { logger } from "../utils/logger";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  enableOfflineQueue: false,
});

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = `ratelimit:${req.ip || req.socket.remoteAddress || "unknown"}`;
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, WINDOW_MS);
    }
    const ttl = await redis.pttl(key);

    res.setHeader("X-RateLimit-Limit", MAX_REQUESTS);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, MAX_REQUESTS - current));
    res.setHeader("X-RateLimit-Reset", Math.ceil((Date.now() + ttl) / 1000));

    if (current > MAX_REQUESTS) {
      res.status(429).json({
        error: "Too many requests",
        message: `Rate limit exceeded. Try again in ${Math.ceil(ttl / 1000)} seconds.`,
        retryAfter: Math.ceil(ttl / 1000),
      });
      logger.warn("Rate limit exceeded", {
        ip: req.ip,
        path: req.path,
        requests: current,
      });
      return;
    }
    next();
  } catch (error) {
    logger.error("Rate limiter error (allowing request)", {
      error: (error as Error).message,
    });
    next();
  }
}
