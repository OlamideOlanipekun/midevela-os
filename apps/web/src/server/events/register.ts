import { initializeEventPipeline } from "@/server/events/init";

// Side-effect import — runs once when the module is first loaded on the server.
// This wires up the event bus, metrics service, and queue workers.
initializeEventPipeline();
