"use client";

import { useDashboard } from "@/lib/dashboard/useDashboard";
import { PlatformHealth } from "@/components/dashboard/PlatformHealth";
import { KPICards } from "@/components/dashboard/KPICards";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { ConversationChart } from "@/components/dashboard/ConversationChart";
import { MerchantGrowth } from "@/components/dashboard/MerchantGrowth";
import { AIHealth } from "@/components/dashboard/AIHealth";
import { QueueStatus } from "@/components/dashboard/QueueStatus";
import { Infrastructure } from "@/components/dashboard/Infrastructure";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { TopMerchants } from "@/components/dashboard/TopMerchants";
import { RecentAlerts } from "@/components/dashboard/RecentAlerts";
import { Spinner } from "@/components/ui/Spinner";

export default function MissionControlPage() {
  const { data, loading, error, lastUpdated } = useDashboard();

  if (loading) {
    return (
      <div className="dash-loading">
        <Spinner size="lg" />
        <p>Loading Mission Control...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash-error">
        <p>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="dash-page">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">Mission Control</div>
          <h1 className="dash-title">Dashboard</h1>
        </div>
        <div className="dash-header-right">
          {lastUpdated && (
            <span className="dash-updated">Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <div className="dash-live-dot" />
        </div>
      </div>

      <KPICards data={data.kpis} />

      <div className="dash-grid-2col">
        <PlatformHealth data={data.health} />
        <RevenueChart data={data.revenue} />
      </div>

      <div className="dash-grid-3col">
        <ConversationChart data={data.conversations} />
        <MerchantGrowth data={data.merchantGrowth} />
        <AIHealth data={data.ai} />
      </div>

      <div className="dash-grid-3col">
        <QueueStatus data={data.queues} />
        <Infrastructure data={data.infrastructure} />
        <RecentAlerts data={data.alerts} />
      </div>

      <div className="dash-grid-2col">
        <RecentActivity data={data.activity} />
        <TopMerchants data={data.topMerchants} />
      </div>
    </div>
  );
}
