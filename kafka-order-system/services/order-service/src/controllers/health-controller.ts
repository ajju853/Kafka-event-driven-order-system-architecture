import { Request, Response } from "express";
import { pool } from "../models/db";

export async function healthCheck(
  _req: Request,
  res: Response
): Promise<void> {
  const checks: Record<string, string> = {};

  try {
    await pool.query("SELECT 1");
    checks.postgres = "healthy";
  } catch {
    checks.postgres = "unhealthy";
  }

  const allHealthy = Object.values(checks).every((s) => s === "healthy");

  res.status(allHealthy ? 200 : 503).json({
    service: "order-service",
    status: allHealthy ? "healthy" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
  });
}
