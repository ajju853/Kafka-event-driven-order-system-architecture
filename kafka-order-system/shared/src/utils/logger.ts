const isProduction = process.env.NODE_ENV === "production";

type LogFn = (msg: string, meta?: Record<string, unknown>) => void;

export interface Logger {
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  debug: LogFn;
}

function createLogFn(serviceName: string, level: string): LogFn {
  return (msg, meta) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: serviceName,
      message: msg,
      ...meta,
    };
    if (isProduction) {
      if (level === "error") {
        console.error(JSON.stringify(entry));
      } else {
        console.log(JSON.stringify(entry));
      }
    } else {
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${serviceName}]`;
      console.log(`${prefix} ${msg}`, meta ? JSON.stringify(meta) : "");
    }
  };
}

export function createLogger(serviceName: string): Logger {
  return {
    info: createLogFn(serviceName, "info"),
    warn: createLogFn(serviceName, "warn"),
    error: createLogFn(serviceName, "error"),
    debug: createLogFn(serviceName, "debug"),
  };
}
