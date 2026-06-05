import { createCounter } from "@kafka-order-system/shared";

export const stockReserved = createCounter("stock_reserved_total", "Total stock reservations");
export const stockReleased = createCounter("stock_released_total", "Total stock releases");
export const stockReservationFailures = createCounter("stock_reservation_failures_total", "Total stock reservation failures");
export const inventoryChecks = createCounter("inventory_checks_total", "Total inventory stock checks");
