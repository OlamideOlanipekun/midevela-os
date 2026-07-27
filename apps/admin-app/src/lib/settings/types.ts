export type SystemConfigItem = {
  id: string;
  key: string;
  value: any;
  category: string;
  description: string | null;
  updatedAt: string;
};

export type IntegrationConfigItem = {
  id: string;
  provider: string;
  label: string;
  enabled: boolean;
  settings: any;
  credentials: any;
  lastTestedAt: string | null;
  testStatus: string | null;
};

export type EmailTemplateItem = {
  id: string;
  slug: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  updatedAt: string;
};

export type SettingsDashboard = {
  configCount: number;
  integrationCount: number;
  activeIntegrations: number;
  templateCount: number;
  recentConfigs: SystemConfigItem[];
};
