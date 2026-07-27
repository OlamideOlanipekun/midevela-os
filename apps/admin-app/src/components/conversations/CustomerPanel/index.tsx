"use client";

import type { CustomerProfile } from "@/lib/conversations/types";

interface CustomerPanelProps {
  customer: CustomerProfile;
}

export function CustomerPanel({ customer }: CustomerPanelProps) {
  const fields = [
    { label: "Name", value: customer.name || "—" },
    { label: "Email", value: customer.email || "—" },
    { label: "Phone", value: customer.phone || "—" },
    { label: "Location", value: customer.location || "—" },
    { label: "Device", value: customer.device || "—" },
    { label: "Browser", value: customer.browser || "—" },
  ];

  const metrics = [
    { label: "Returning", value: customer.returning ? "Yes" : "No" },
    { label: "Conversations", value: customer.totalConversations },
    { label: "Total Orders", value: customer.totalOrders },
    { label: "LTV", value: customer.lifetimeValue > 0 ? `₦${customer.lifetimeValue.toLocaleString()}` : "—" },
  ];

  return (
    <div className="panel-section">
      <h3 className="panel-title">Customer Profile</h3>
      <div className="panel-metrics">
        {metrics.map((m) => (
          <div key={m.label} className="panel-metric">
            <span className="panel-metric-value">{m.value}</span>
            <span className="panel-metric-label">{m.label}</span>
          </div>
        ))}
      </div>
      <div className="panel-fields">
        {fields.map((f) => (
          <div key={f.label} className="panel-field">
            <span className="panel-field-label">{f.label}</span>
            <span className="panel-field-value">{f.value}</span>
          </div>
        ))}
      </div>
      <h3 className="panel-title mt-3">Shopping Context</h3>
      <div className="panel-fields">
        <div className="panel-field">
          <span className="panel-field-label">Current Page</span>
          <span className="panel-field-value">{customer.currentPage || "—"}</span>
        </div>
        <div className="panel-field">
          <span className="panel-field-label">Products Viewed</span>
          <span className="panel-field-value">{(customer.productsViewed || []).join(", ") || "—"}</span>
        </div>
        <div className="panel-field">
          <span className="panel-field-label">Session Duration</span>
          <span className="panel-field-value">{customer.sessionDuration > 0 ? `${Math.floor(customer.sessionDuration / 60)}m ${customer.sessionDuration % 60}s` : "—"}</span>
        </div>
      </div>
    </div>
  );
}
