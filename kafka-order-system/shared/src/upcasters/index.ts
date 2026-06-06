import { StoredEvent } from "../events/domain-events";

export type UpcasterFn = (event: StoredEvent) => StoredEvent;

export interface UpcasterEntry {
  fromVersion: number;
  toVersion: number;
  fn: UpcasterFn;
}
