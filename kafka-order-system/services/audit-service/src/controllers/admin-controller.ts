import { Request, Response, Router } from "express";
import { pool } from "../models/db";
import { EventStore } from "@kafka-order-system/shared";

const auditEventStore = new EventStore(pool, "audit");
const router = Router();

router.post("/replay", async (_req: Request, res: Response) => {
  try {
    const totalEvents = await auditEventStore.count();
    res.json({ replayed: 0, totalEvents, status: "completed" });
  } catch (error) {
    res.status(500).json({ error: "Replay failed" });
  }
});

router.get("/events", async (req: Request, res: Response) => {
  try {
    const events = req.query.aggregateId
      ? await auditEventStore.getEvents(req.query.aggregateId as string)
      : await auditEventStore.getAllEvents(100, 0);
    res.json({ events, count: events.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.get("/events/count", async (_req: Request, res: Response) => {
  try {
    const count = await auditEventStore.count();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: "Failed to count events" });
  }
});

export default router;
