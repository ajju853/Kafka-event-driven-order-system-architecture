import { Request, Response, Router } from "express";
import { pool } from "../models/db";
import { logger } from "../utils/logger";
import { paymentEventStore } from "../services/event-sourcing";
import { projectPaymentEvent } from "../projections/payment-projection";

const router = Router();

router.post("/replay", async (_req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const totalEvents = await paymentEventStore.count();
    let replayed = 0;
    let offset = 0;
    const batchSize = 100;

    while (true) {
      const events = await paymentEventStore.getAllEvents(batchSize, offset);
      if (events.length === 0) break;

      for (const event of events) {
        await client.query("BEGIN");
        try {
          await projectPaymentEvent(client, event);
          await client.query("COMMIT");
          replayed++;
        } catch (error) {
          await client.query("ROLLBACK");
          logger.error("Replay failed for event", {
            eventId: event.eventId,
            error: (error as Error).message,
          });
        }
      }
      offset += batchSize;
    }

    res.json({ replayed, totalEvents, status: "completed" });
  } catch (error) {
    logger.error("Event replay failed", { error: (error as Error).message });
    res.status(500).json({ error: "Replay failed" });
  } finally {
    client.release();
  }
});

router.get("/events", async (req: Request, res: Response) => {
  try {
    const aggregateId = req.query.aggregateId as string;
    const events = aggregateId
      ? await paymentEventStore.getEvents(aggregateId)
      : await paymentEventStore.getAllEvents(100, 0);
    res.json({ events, count: events.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.get("/events/count", async (_req: Request, res: Response) => {
  try {
    const count = await paymentEventStore.count();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: "Failed to count events" });
  }
});

export default router;
