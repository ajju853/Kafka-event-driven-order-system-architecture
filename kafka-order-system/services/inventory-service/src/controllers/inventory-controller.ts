import { Request, Response, NextFunction } from "express";
import { pool } from "../models/db";
import { redis, getInventoryCache, setInventoryCache } from "../config/redis";
import { logger } from "../utils/logger";

export async function getInventory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productId = req.params.productId;

    const cached = await getInventoryCache(productId);
    if (cached !== null) {
      res.json({
        success: true,
        data: { productId, quantity: cached, source: "cache" },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await pool.query(
      `SELECT product_id, quantity, reserved FROM inventory WHERE product_id = $1`,
      [productId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: "Product not found in inventory",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const row = result.rows[0];
    const available = row.quantity - (row.reserved || 0);
    await setInventoryCache(productId, available);

    res.json({
      success: true,
      data: {
        productId: row.product_id,
        totalQuantity: parseInt(row.quantity, 10),
        reserved: parseInt(row.reserved || 0, 10),
        available,
        source: "database",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getReservationsByOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orderId = req.params.orderId;
    const result = await pool.query(
      `SELECT * FROM inventory_reservations WHERE order_id = $1`,
      [orderId]
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
