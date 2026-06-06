import { Request, Response, Router } from "express";
import { Pool } from "pg";
import { config } from "../config";
import { EventStore } from "@kafka-order-system/shared";

const adminPool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  max: 5,
});

adminPool.on("error", (err) => {
  console.error("Admin pool error", err.message);
});

const notifEventStore = new EventStore(adminPool, "notification");

const router = Router();

router.post("/replay", async (_req: Request, res: Response) => {
  try {
    await notifEventStore.initializeSchema();
    const count = await notifEventStore.count();
    res.json({ replayed: 0, totalEvents: count, status: "completed" });
  } catch (error) {
    res.status(500).json({ error: "Replay failed" });
  }
});

router.get("/events", async (req: Request, res: Response) => {
  try {
    const events = req.query.aggregateId
      ? await notifEventStore.getEvents(req.query.aggregateId as string)
      : await notifEventStore.getAllEvents(100, 0);
    res.json({ events, count: events.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.get("/events/count", async (_req: Request, res: Response) => {
  try {
    const count = await notifEventStore.count();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: "Failed to count events" });
  }
});

export default router;
