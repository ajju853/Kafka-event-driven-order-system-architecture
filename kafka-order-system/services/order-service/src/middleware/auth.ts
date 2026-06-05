import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

const API_KEYS = new Set([
  "pk_test_order_system_2024",
  process.env.API_KEY || "",
].filter(Boolean));

interface AuthenticatedRequest extends Request {
  clientId?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing Authorization header",
    });
    return;
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid Authorization format. Use: Bearer <token>",
    });
    return;
  }

  if (!API_KEYS.has(token)) {
    res.status(403).json({
      error: "Forbidden",
      message: "Invalid API key",
    });
    logger.warn("Invalid API key attempt", {
      ip: req.ip,
      path: req.path,
      scheme,
    });
    return;
  }

  req.clientId = `client_${token.slice(0, 8)}`;
  next();
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token && API_KEYS.has(token)) {
      req.clientId = `client_${token.slice(0, 8)}`;
    }
  }
  next();
}
