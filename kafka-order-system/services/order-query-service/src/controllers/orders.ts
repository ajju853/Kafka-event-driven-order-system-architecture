import { Router, Request, Response } from "express";
import { pool } from "../models/db";

const router = Router();

router.get("/orders", async (_req: Request, res: Response) => {
  const result = await pool.query(
    "SELECT * FROM order_summary ORDER BY created_at DESC LIMIT 100"
  );
  res.json(result.rows);
});

router.get("/orders/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await pool.query(
    "SELECT * FROM order_summary WHERE order_id = $1",
    [id]
  );
  if (result.rowCount === 0) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(result.rows[0]);
});

router.get("/orders/customer/:customerId", async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const result = await pool.query(
    "SELECT * FROM customer_orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50",
    [customerId]
  );
  res.json(result.rows);
});

router.get("/orders/timeline/:orderId", async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const result = await pool.query(
    "SELECT * FROM order_timeline WHERE order_id = $1 ORDER BY occurred_at ASC",
    [orderId]
  );
  res.json(result.rows);
});

export default router;
