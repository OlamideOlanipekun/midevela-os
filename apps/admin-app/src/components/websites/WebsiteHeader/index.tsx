"use client";

import type { WebsiteDetail } from "@/lib/websites/types";
import { Badge } from "@/components/ui/Badge";
import { WebsiteActions } from "@/components/websites/WebsiteActions";

interface WebsiteHeaderProps {
  website: WebsiteDetail;
  onVerify: () => void;
  onRecrawl: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  onTransfer: () => void;
}

const statusVariant = (s: string) => {
  switch (s) {
    case "ACTIVE": return "teal" as const;
    case "INACTIVE": return "gold" as const;
    case "SUSPENDED": return "rust" as const;
    case "DELETED": return "default" as const;
    default: return "default" as const;
  }
};

export function WebsiteHeader({ website, onVerify, onRecrawl, onSuspend, onReactivate, onDelete, onTransfer }: WebsiteHeaderProps) {
  return (
    <div className="mcht-hdr">
      <div className="mcht-hdr-main">
        <div className="mcht-hdr-logo">
          <div className="mcht-logo-fallback">{website.domain.charAt(0).toUpperCase()}</div>
        </div>
        <div className="mcht-hdr-info">
          <div className="mcht-hdr-name-row">
            <h1 className="mcht-hdr-name">{website.domain}</h1>
            <Badge variant={statusVariant(website.status)} size="md">{website.status}</Badge>
            {website.verified && <Badge variant="teal" size="sm">Verified</Badge>}
          </div>
          <div className="mcht-hdr-meta">
            <span className="mcht-hdr-meta-item">{website.merchant.name}</span>
            <span className="mcht-hdr-meta-item">{website.normalizedUrl}</span>
            <span className="mcht-hdr-meta-item">Health {website.healthScore}%</span>
            <span className="mcht-hdr-meta-item">SSL {website.sslStatus}</span>
          </div>
        </div>
      </div>
      <WebsiteActions
        websiteId={website.id}
        status={website.status}
        verified={website.verified}
        crawlStatus={website.crawlStatus}
        onVerify={onVerify}
        onRecrawl={onRecrawl}
        onSuspend={onSuspend}
        onReactivate={onReactivate}
        onDelete={onDelete}
        onTransfer={onTransfer}
      />
    </div>
  );
}
