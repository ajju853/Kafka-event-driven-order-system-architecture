import { Request, Response, NextFunction } from "express";
import { pool } from "../models/db";

export async function getDashboardMetrics(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [ordersResult, revenueResult, dailyResult] = await Promise.all([
      pool.query(`
        SELECT status, COUNT(*) as count
        FROM order_metrics
        GROUP BY status
      `),
      pool.query(`
        SELECT COALESCE(SUM(total_amount), 0) as total_revenue
        FROM order_metrics
      `),
      pool.query(`
        SELECT * FROM daily_order_summary
        ORDER BY date DESC
        LIMIT 30
      `),
    ]);

    res.json({
      success: true,
      data: {
        orderBreakdown: ordersResult.rows,
        totalRevenue: parseFloat(revenueResult.rows[0].total_revenue),
        dailySummary: dailyResult.rows,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getDailySummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const result = await pool.query(
      `SELECT * FROM daily_order_summary
       ORDER BY date DESC
       LIMIT $1`,
      [days]
    );

    res.json({
      success: true,
      data: result.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
