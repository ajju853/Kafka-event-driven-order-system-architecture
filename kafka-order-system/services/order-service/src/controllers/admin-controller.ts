import { Request, Response, Router } from "express";
import { pool } from "../models/db";
import { logger } from "../utils/logger";
import { orderEventStore } from "../services/event-sourcing";
import { projectOrderEvent } from "../projections/order-projection";
const router = Router();

router.post("/replay", async (_req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const totalEvents = await orderEventStore.count();
    logger.info("Starting event replay", { totalEvents });

    let replayed = 0;
    let offset = 0;
    const batchSize = 100;

    while (true) {
      const events = await orderEventStore.getAllEvents(batchSize, offset);
      if (events.length === 0) break;

      for (const event of events) {
        await client.query("BEGIN");
        try {
          await projectOrderEvent(client, event);
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

    logger.info("Event replay completed", { replayed, totalEvents });
    res.json({ replayed, totalEvents, status: "completed" });
  } catch (error) {
    logger.error("Event replay failed", {
      error: (error as Error).message,
    });
    res.status(500).json({ error: "Replay failed" });
  } finally {
    client.release();
  }
});

export default router;
