import { startMetricsService } from "@/server/metrics/service";
import { registerWorkers } from "@/server/queues/workers";

let initialized = false;

/**
 * Initializes the event system, metrics service, and workers.
 * Call once at app startup.
 */
export function initializeEventPipeline(): void {
  if (initialized) return;
  initialized = true;

  startMetricsService();
  registerWorkers();

  console.log("[EventPipeline] initialized");
}
