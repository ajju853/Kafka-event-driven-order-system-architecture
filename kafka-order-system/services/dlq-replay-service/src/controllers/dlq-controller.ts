import { Request, Response } from "express";
import { DLQReplayService } from "../services/dlq-replay";
import { logger } from "../utils/logger";

export function createDLQController(replayService: DLQReplayService) {
  return {
    async listEvents(req: Request, res: Response) {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const result = await replayService.getEvents(limit, offset);
        res.json(result);
      } catch (error) {
        logger.error("Error listing DLQ events", { error: (error as Error).message });
        res.status(500).json({ error: "Failed to list DLQ events" });
      }
    },

    async getEvent(req: Request, res: Response) {
      try {
        const event = await replayService.getEvent(req.params.eventId);
        if (!event) {
          return res.status(404).json({ error: "DLQ event not found" });
        }
        res.json(event);
      } catch (error) {
        logger.error("Error getting DLQ event", { error: (error as Error).message });
        res.status(500).json({ error: "Failed to get DLQ event" });
      }
    },

    async replayEvent(req: Request, res: Response) {
      try {
        const result = await replayService.replayEvent(req.params.eventId);
        if (!result.success) {
          return res.status(400).json(result);
        }
        res.json(result);
      } catch (error) {
        logger.error("Error replaying DLQ event", { error: (error as Error).message });
        res.status(500).json({ error: "Failed to replay DLQ event" });
      }
    },

    async replayAll(req: Request, res: Response) {
      try {
        const events = await replayService.getEvents(1000, 0);
        const results = [];
        for (const event of events.events as Array<{ event_id: string }>) {
          const result = await replayService.replayEvent(event.event_id);
          results.push({ eventId: event.event_id, ...result });
        }
        res.json({ replayed: results.length, results });
      } catch (error) {
        logger.error("Error replaying all DLQ events", { error: (error as Error).message });
        res.status(500).json({ error: "Failed to replay all DLQ events" });
      }
    },
  };
}
