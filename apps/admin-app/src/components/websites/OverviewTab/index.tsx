"use client";

import type { WebsiteDetail } from "@/lib/websites/types";
import { Badge } from "@/components/ui/Badge";
import { HealthBadge } from "@/components/websites/HealthBadge";

interface OverviewTabProps {
  website: WebsiteDetail;
}

export function OverviewTab({ website }: OverviewTabProps) {
  const cards = [
    { label: "Domain", value: website.domain },
    { label: "Merchant", value: website.merchant.name },
    { label: "Workspace", value: website.merchant.slug },
    { label: "Verification", value: website.verified ? "Verified" : "Unverified", badge: website.verified ? "teal" : "gold" },
    { label: "SSL", value: website.sslStatus === "valid" ? "Valid" : website.sslStatus === "unknown" ? "Unknown" : "Invalid" },
    { label: "Products", value: website.products.toLocaleString() },
    { label: "Knowledge", value: website.knowledgeEntries.toLocaleString() },
    { label: "Crawler", value: website.crawlStatus.replace(/_/g, " ") },
  ];

  return (
    <div>
      <div className="flx-row gap-4 mb-4">
        <HealthBadge score={website.health.score} />
        <div className="flex-1">
          <div className="text-lg font-bold text-ink">Website Health</div>
          <p className="text-sm text-ink-soft">{website.health.label}</p>
          <div className="mcht-health-list mt-2">
            {[
              { l: "SSL", v: website.health.ssl },
              { l: "Crawler", v: website.health.crawler },
              { l: "Knowledge", v: website.health.knowledge },
              { l: "Products", v: website.health.products },
              { l: "Availability", v: website.health.availability },
            ].map((m) => (
              <div key={m.l} className="mcht-health-row">
                <span className="mcht-health-label">{m.l}</span>
                <div className="mcht-health-bar-track">
                  <div className="mcht-health-bar-fill" style={{ width: `${m.v}%`, backgroundColor: m.v >= 80 ? "#22c55e" : m.v >= 50 ? "#eab308" : "#ef4444" }} />
                </div>
                <span className="mcht-health-val">{m.v}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ws-info">
        {cards.map((c) => (
          <div key={c.label} className="ws-field">
            <span className="ws-label">{c.label}</span>
            {"badge" in c ? (
              <Badge variant={(c as any).badge} size="sm">{(c as any).value}</Badge>
            ) : (
              <span className="ws-value">{c.value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
