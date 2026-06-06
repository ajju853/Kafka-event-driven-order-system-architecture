import { StoredEvent } from "../events/domain-events";
import { UpcasterEntry } from "./index";

const registry = new Map<string, UpcasterEntry[]>();

export function registerUpcaster(
  eventType: string,
  entry: UpcasterEntry
): void {
  const key = eventType;
  if (!registry.has(key)) {
    registry.set(key, []);
  }
  registry.get(key)!.push(entry);
}

export function applyUpcasters(event: StoredEvent): StoredEvent {
  const entries = registry.get(event.eventType);
  if (!entries) return event;

  let current = event;
  for (const entry of entries.sort((a, b) => a.fromVersion - b.fromVersion)) {
    if (current.version === entry.fromVersion) {
      current = entry.fn(current);
    }
  }
  return current;
}
