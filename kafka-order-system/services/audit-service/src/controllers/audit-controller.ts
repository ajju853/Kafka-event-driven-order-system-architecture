import { Request, Response, NextFunction } from "express";
import { pool } from "../models/db";

export async function getAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const eventType = req.query.eventType as string | undefined;
    const aggregateId = req.query.aggregateId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const conditions: string[] = [];
    const params: string[] = [];
    let paramIndex = 1;

    if (eventType) {
      conditions.push(`event_type = $${paramIndex++}`);
      params.push(eventType);
    }
    if (aggregateId) {
      conditions.push(`aggregate_id = $${paramIndex++}`);
      params.push(aggregateId);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM event_audit_log ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT * FROM event_audit_log
       ${where}
       ORDER BY ingested_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit.toString(), offset.toString()]
    );

    res.json({
      success: true,
      data: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getAuditStats(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        event_type,
        COUNT(*) as count,
        MIN(ingested_at) as first_seen,
        MAX(ingested_at) as last_seen
      FROM event_audit_log
      GROUP BY event_type
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: result.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
