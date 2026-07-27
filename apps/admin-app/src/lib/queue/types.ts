export interface QueueDashboard {
  queues: QueueStatus[];
  runningJobs: number;
  queued: number;
  completed: number;
  failed: number;
  retrying: number;
}

export interface QueueStatus {
  name: string;
  status: string;
  running: number;
  queued: number;
  failed: number;
  avgWaitTime: number;
  avgProcessingTime: number;
}

export interface QueueJobItem {
  id: string;
  orgId: string | null;
  queue: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  worker: string | null;
  duration: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface WorkerLogItem {
  id: string;
  worker: string;
  queue: string;
  event: string;
  jobId: string | null;
  message: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WorkerHealth {
  worker: string;
  cpu: number;
  ram: number;
  runningJobs: number;
  avgDuration: number;
  errors: number;
  restartCount: number;
}

export interface DeadLetterItem {
  id: string;
  queue: string;
  type: string;
  payload: Record<string, unknown>;
  error: string | null;
  attempts: number;
  failedAt: string;
}
