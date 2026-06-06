import { Request, Response, Router } from "express";
import { analyticsEventStore } from "../models/db";
import { logger } from "../utils/logger";

const router = Router();

router.post("/replay/analytics", async (_req: Request, res: Response) => {
  try {
    const totalEvents = await analyticsEventStore.count();
    res.json({ replayed: 0, totalEvents, status: "completed" });
  } catch (error) {
    logger.error("Analytics replay failed", { error: (error as Error).message });
    res.status(500).json({ error: "Replay failed" });
  }
});

router.get("/events", async (req: Request, res: Response) => {
  try {
    const events = req.query.aggregateId
      ? await analyticsEventStore.getEvents(req.query.aggregateId as string)
      : await analyticsEventStore.getAllEvents(100, 0);
    res.json({ events, count: events.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.get("/events/count", async (_req: Request, res: Response) => {
  try {
    const count = await analyticsEventStore.count();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: "Failed to count events" });
  }
});

export default router;
