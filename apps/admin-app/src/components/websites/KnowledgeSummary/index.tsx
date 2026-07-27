"use client";

import { MerchantStats } from "@/components/merchant/MerchantStats";

export function KnowledgeSummary({ count = 0 }: { count: number }) {
  return (
    <div className="stat-card">
      <h3 className="stat-title">Knowledge Base</h3>
      <MerchantStats stats={[
        { label: "Documents", value: count.toLocaleString() },
        { label: "Coverage", value: "—" },
        { label: "Missing Answers", value: "—" },
      ]} />
    </div>
  );
}
