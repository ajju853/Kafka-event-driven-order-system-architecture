import { StoredEvent } from "../events/domain-events";
import { registerUpcaster } from "./registry";

registerUpcaster("OrderCreated", {
  fromVersion: 1,
  toVersion: 2,
  fn: (event: StoredEvent): StoredEvent => ({
    ...event,
    version: 2,
    payload: {
      ...event.payload,
      customerEmail: (event.payload as Record<string, unknown>).customerEmail || null,
    },
  }),
});
