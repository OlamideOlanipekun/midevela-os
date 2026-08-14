import { Queue, Worker, type Job } from "bullmq";
import { publishQueueHealth } from "@/server/events/instrument";

const REDIS_URL = process.env.REDIS_URL;

export interface InProcessJob<T = any> {
  id: string;
  name: string;
  data: T;
}

interface QueueConfig {
  name: string;
  concurrency?: number;
  handler: (job: Job | InProcessJob) => Promise<void>;
}

const queues = new Map<string, Queue>();
const inProcessHandlers = new Map<string, (job: Job | InProcessJob) => Promise<void>>();

function getConnection() {
  if (!REDIS_URL) return null;
  return { url: REDIS_URL };
}

export function createQueue(name: string): Queue | null {
  if (queues.has(name)) return queues.get(name)!;

  const connection = getConnection();
  if (!connection) {
    return null;
  }

  try {
    const queue = new Queue(name, { connection });
    queues.set(name, queue);
    return queue;
  } catch (err) {
    console.warn(`[Queue] Failed to initialize BullMQ queue ${name}:`, err);
    return null;
  }
}

export function createWorker(config: QueueConfig): Worker | null {
  // Always register in-process handler as fallback
  inProcessHandlers.set(config.name, config.handler);

  const connection = getConnection();
  if (!connection) {
    console.log(`[Worker] Registered in-process worker handler for queue: ${config.name}`);
    return null;
  }

  try {
    const worker = new Worker(config.name, config.handler as (job: Job) => Promise<void>, {
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
  } catch (err) {
    console.warn(`[Worker] Failed to start BullMQ worker for ${config.name}, falling back to in-process:`, err);
    return null;
  }
}

let mockJobCounter = 0;

export async function enqueue(name: string, payload: any, options?: { delay?: number }): Promise<void> {
  const queue = createQueue(name);

  if (queue) {
    try {
      await queue.add(name, payload, {
        delay: options?.delay,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      });
      return;
    } catch (err) {
      console.warn(`[Queue] BullMQ enqueue failed for ${name}, falling back to in-process execution:`, err);
    }
  }

  // Fallback: execute via in-process worker handler asynchronously
  const handler = inProcessHandlers.get(name);
  if (handler) {
    const fakeJob: InProcessJob = {
      id: `inprocess_${Date.now()}_${++mockJobCounter}`,
      name,
      data: payload,
    };
    const run = async () => {
      try {
        await handler(fakeJob);
        publishQueueHealth(name, 0, 0, 0);
      } catch (err) {
        console.error(`[Worker:InProcess] ${name} job ${fakeJob.id} failed:`, err);
      }
    };
    if (options?.delay && options.delay > 0) {
      setTimeout(run, options.delay);
    } else {
      setImmediate(run);
    }
  } else {
    console.warn(`[Queue] No worker registered for queue: ${name}`);
    publishQueueHealth(name, 0, 0, 0);
  }
}

