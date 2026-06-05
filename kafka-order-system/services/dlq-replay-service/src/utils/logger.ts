export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "INFO", service: "dlq-replay", message: msg, ...meta }));
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: "WARN", service: "dlq-replay", message: msg, ...meta }));
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "ERROR", service: "dlq-replay", message: msg, ...meta }));
  },
};
