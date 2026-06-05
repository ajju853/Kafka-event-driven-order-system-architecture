import { Request, Response, NextFunction } from "express";
import { OrderService } from "../services/order-service";
import { CreateOrderRequestSchema } from "../middleware/validation";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";
import { ZodError } from "zod";

const orderService = new OrderService();

export async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validated = CreateOrderRequestSchema.parse(req.body);
    const result = await orderService.createOrder(validated);
    res.status(201).json({
      success: true,
      data: result,
      requestId: req.headers["x-request-id"] || uuidv4(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(error);
  }
}

export async function getOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await orderService.getOrder(req.params.id);
    if (!order) {
      res.status(404).json({
        success: false,
        error: "Order not found",
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      success: true,
      data: order,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function listOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerId = req.query.customerId as string | undefined;
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const result = await orderService.listOrders(customerId, status, page, limit);
    res.json({
      success: true,
      data: result.orders,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { reason } = req.body;
    await orderService.cancelOrder(req.params.id, reason);
    res.json({
      success: true,
      data: { orderId: req.params.id, status: "CANCELLED" },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cannot cancel")) {
      res.status(409).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(error);
  }
}
