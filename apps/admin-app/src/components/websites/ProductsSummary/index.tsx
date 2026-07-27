"use client";

import { MerchantStats } from "@/components/merchant/MerchantStats";

export function ProductsSummary({ count = 0 }: { count: number }) {
  return (
    <div className="stat-card">
      <h3 className="stat-title">Products</h3>
      <MerchantStats stats={[
        { label: "Total Products", value: count.toLocaleString() },
        { label: "Categories", value: "—" },
        { label: "Out of Stock", value: "—" },
        { label: "Variants", value: "—" },
      ]} />
    </div>
  );
}
