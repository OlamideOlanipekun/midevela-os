"use client";

import type { MerchantBilling } from "@/lib/merchant/types";
import { Badge } from "@/components/ui/Badge";

interface BillingTabProps {
  data: MerchantBilling | null;
}

export function BillingTab({ data }: BillingTabProps) {
  if (!data) {
    return <p className="text-sm text-ink-soft">No billing data available.</p>;
  }

  const statusVariant = (s: string) => {
    switch (s) {
      case "ACTIVE": return "teal" as const;
      case "TRIALING": return "sage" as const;
      case "PAST_DUE": return "gold" as const;
      case "CANCELLED": case "EXPIRED": return "rust" as const;
      default: return "default" as const;
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="stat-title">Current Plan</h3>
          <div className="mt-2 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-ink-soft">Plan</span>
              <span className="text-sm font-semibold">{data.plan.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-ink-soft">Price</span>
              <span className="text-sm font-mono font-semibold">{data.plan.currency} {Number(data.plan.priceMonthly).toLocaleString()}/mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-ink-soft">Status</span>
              <Badge variant={statusVariant(data.status)} size="sm">{data.status.replace("_", " ")}</Badge>
            </div>
            {data.renewal && (
              <div className="flex justify-between">
                <span className="text-sm text-ink-soft">Renewal</span>
                <span className="text-sm">{new Date(data.renewal).toLocaleDateString()}</span>
              </div>
            )}
            {data.trialEndsAt && (
              <div className="flex justify-between">
                <span className="text-sm text-ink-soft">Trial Ends</span>
                <span className="text-sm">{new Date(data.trialEndsAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="stat-card">
          <h3 className="stat-title">Payment Method</h3>
          {data.paymentMethod ? (
            <div className="mt-2 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-ink-soft">Type</span>
                <span className="text-sm">{data.paymentMethod.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-ink-soft">Card</span>
                <span className="text-sm font-mono">•••• {data.paymentMethod.last4}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-ink-soft">Expires</span>
                <span className="text-sm">{data.paymentMethod.expDate}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-soft mt-2">No payment method on file.</p>
          )}
        </div>
      </div>

      <div className="stat-card mt-4">
        <h3 className="stat-title">Invoices</h3>
        {data.invoices.length > 0 ? (
          <div className="inv-list mt-2">
            {data.invoices.map((inv) => (
              <div key={inv.id} className="inv-row">
                <span>{new Date(inv.date).toLocaleDateString()}</span>
                <span className="font-mono">{data.plan.currency} {Number(inv.amount).toLocaleString()}</span>
                <Badge variant={inv.status === "paid" ? "teal" : "gold"} size="sm">{inv.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">No invoices yet.</p>
        )}
      </div>
    </div>
  );
}
