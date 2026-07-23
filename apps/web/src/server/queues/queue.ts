import { Queue, Worker, type Job } from "bullmq";
import { eventBus } from "@/server/events/bus";
import { publishQueueHealth } from "@/server/events/instrument";

const REDIS_URL = process.env.REDIS_URL;

interface QueueConfig {
  name: string;
  concurrency?: number;
  handler: (job: Job) => Promise<void>;
}

const queues = new Map<string, Queue>();

function getConnection() {
  if (!REDIS_URL) return null;
  return { url: REDIS_URL };
}

export function createQueue(name: string): Queue | null {
  if (queues.has(name)) return queues.get(name)!;

  const connection = getConnection();
  if (!connection) {
    console.warn(`[Queue] No REDIS_URL — ${name} will use in-process event bus`);
    return null;
  }

  const queue = new Queue(name, { connection });
  queues.set(name, queue);
  return queue;
}

export function createWorker(config: QueueConfig): Worker | null {
  const connection = getConnection();
  if (!connection) {
    console.warn(`[Worker] No REDIS_URL — ${config.name} running in-process`);
    return null;
  }

  const worker = new Worker(config.name, config.handler, {
    connection,
    concurrency: config.concurrency || 5,
  });

  worker.on("completed", (job) => {
    publishQueueHealth(config.name, 0, 0, 0);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] ${config.name} job ${job?.id} failed:`, err);
  });

  return worker;
}

export async function enqueue(name: string, payload: any, options?: { delay?: number }): Promise<void> {
  const queue = createQueue(name);

  if (!queue) {
    publishQueueHealth(name, 0, 0, 0);
    return;
  }

  await queue.add(name, payload, {
    delay: options?.delay,
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  });
}
