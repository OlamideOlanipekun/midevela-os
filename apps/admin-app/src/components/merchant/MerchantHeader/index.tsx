"use client";

import type { MerchantDetail } from "@/lib/merchant/types";
import { Badge } from "@/components/ui/Badge";
import { MerchantActions } from "@/components/merchant/MerchantActions";

interface MerchantHeaderProps {
  merchant: MerchantDetail;
  onLoginAs: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}

const statusVariant = (s: string) => {
  switch (s) {
    case "active": return "teal" as const;
    case "trialing": return "sage" as const;
    case "past_due": return "gold" as const;
    case "cancelled": return "default" as const;
    case "expired": return "rust" as const;
    default: return "default" as const;
  }
};

export function MerchantHeader({ merchant, onLoginAs, onSuspend, onReactivate, onDelete }: MerchantHeaderProps) {
  const isSuspended = (merchant.settings?.suspended as boolean) || false;
  const sub = merchant.subscription;

  return (
    <div className="mcht-hdr">
      <div className="mcht-hdr-main">
        <div className="mcht-hdr-logo">
          {merchant.logoUrl ? (
            <img src={merchant.logoUrl} alt={merchant.name} className="mcht-logo-img" />
          ) : (
            <div className="mcht-logo-fallback">{merchant.name.charAt(0).toUpperCase()}</div>
          )}
        </div>
        <div className="mcht-hdr-info">
          <div className="mcht-hdr-name-row">
            <h1 className="mcht-hdr-name">{merchant.name}</h1>
            <Badge variant={statusVariant(sub?.status ?? "trialing")} size="md">
              {isSuspended ? "Suspended" : sub?.status ?? "Trialing"}
            </Badge>
          </div>
          <div className="mcht-hdr-meta">
            {merchant.owner?.email && (
              <span className="mcht-hdr-meta-item">{merchant.owner.email}</span>
            )}
            {merchant.websiteUrl && (
              <span className="mcht-hdr-meta-item">{merchant.websiteUrl}</span>
            )}
            <span className="mcht-hdr-meta-item">{sub?.planName ?? "No plan"}</span>
            <span className="mcht-hdr-meta-item">Created {new Date(merchant.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <MerchantActions
        merchantId={merchant.id}
        isSuspended={isSuspended}
        onLoginAs={onLoginAs}
        onSuspend={onSuspend}
        onReactivate={onReactivate}
        onDelete={onDelete}
      />
    </div>
  );
}
