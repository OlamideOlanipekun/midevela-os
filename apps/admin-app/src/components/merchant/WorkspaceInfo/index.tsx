"use client";

import type { MerchantDetail } from "@/lib/merchant/types";

interface WorkspaceInfoProps {
  merchant: MerchantDetail;
}

export function WorkspaceInfo({ merchant }: WorkspaceInfoProps) {
  const fields = [
    { label: "Business Name", value: merchant.name },
    { label: "Slug", value: merchant.slug },
    { label: "Email", value: merchant.owner?.email ?? "—" },
    { label: "Phone", value: "—" },
    { label: "Country", value: merchant.country },
    { label: "Currency", value: merchant.currency },
    { label: "Timezone", value: "—" },
    { label: "Language", value: "—" },
    { label: "Industry", value: merchant.industry ?? "—" },
    { label: "Created", value: new Date(merchant.createdAt).toLocaleDateString() },
    { label: "Last Login", value: merchant.owner?.lastLoginAt ? new Date(merchant.owner.lastLoginAt).toLocaleDateString() : "—" },
  ];

  return (
    <div className="ws-info">
      {fields.map((f) => (
        <div key={f.label} className="ws-field">
          <span className="ws-label">{f.label}</span>
          <span className="ws-value">{f.value}</span>
        </div>
      ))}
    </div>
  );
}
