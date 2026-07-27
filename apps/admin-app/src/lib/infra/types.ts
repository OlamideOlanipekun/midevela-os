export type InfraMetricItem = {
  id: string;
  type: string;
  value: number;
  unit: string;
  label: string | null;
  tags: any;
  recordedAt: string;
};

export type DeploymentItem = {
  id: string;
  version: string;
  service: string;
  environment: string;
  status: string;
  commitHash: string | null;
  branch: string | null;
  author: string | null;
  duration: number | null;
  changelog: any;
  createdAt: string;
};

export type ScheduledTaskItem = {
  id: string;
  name: string;
  cron: string;
  type: string;
  active: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  nextRunAt: string | null;
  description: string | null;
};

export type InfraDashboard = {
  metricCount: number;
  deploymentCount: number;
  activeTasks: number;
  failedDeployments: number;
  latestMetrics: InfraMetricItem[];
  recentDeployments: DeploymentItem[];
};
