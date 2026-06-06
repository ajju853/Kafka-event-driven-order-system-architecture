import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { initializeDatabase } from "./models/db";
import { startConsumer } from "./projections/consumer";
import { logger } from "./utils/logger";
import orderRouter from "./controllers/orders";

async function main() {
  const app = express();
  app.use(cors());
  app.use(helmet());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api", orderRouter);

  await initializeDatabase();
  await startConsumer();

  app.listen(config.port, () => {
    logger.info(`Order Query Service running on port ${config.port}`);
  });
}

main().catch((err) => {
  logger.error("Fatal error starting query service", {
    error: (err as Error).message,
  });
  process.exit(1);
});
