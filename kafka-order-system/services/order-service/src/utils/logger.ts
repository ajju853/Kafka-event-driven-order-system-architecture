const isProduction = process.env.NODE_ENV === "production";

function log(level: string, message: string, meta?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "order-service",
    message,
    ...meta,
  };
  if (isProduction) {
    console.log(JSON.stringify(entry));
  } else {
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${entry.service}]`;
    console.log(`${prefix} ${message}`, meta ? JSON.stringify(meta) : "");
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
};
