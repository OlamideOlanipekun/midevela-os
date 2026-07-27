"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/Table";
import type { ConversationListItem } from "@/lib/conversations/types";

interface ConversationTableProps {
  items: ConversationListItem[];
}

const statusVariant = (s: string) => {
  switch (s) {
    case "ACTIVE": return "teal" as const;
    case "ENDED": return "default" as const;
    case "HANDED_OFF": return "gold" as const;
    default: return "default" as const;
  }
};

const qualityColor = (s: number) => s >= 85 ? "#22c55e" : s >= 70 ? "#eab308" : s >= 50 ? "#f97316" : "#ef4444";

function fmtTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ConversationTable({ items }: ConversationTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Customer</TableHeader>
          <TableHeader>Merchant</TableHeader>
          <TableHeader>Started</TableHeader>
          <TableHeader>Status</TableHeader>
          <TableHeader>Messages</TableHeader>
          <TableHeader>AI</TableHeader>
          <TableHeader>Quality</TableHeader>
          <TableHeader>Intent</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((c) => (
          <TableRow key={c.id} onClick={() => window.location.href = `/conversations/${c.id}`}>
            <TableCell>
              <div className="mcht-info">
                <span className="mcht-name">{c.customerName || c.customerEmail || "Anonymous"}</span>
                {c.customerName && c.customerEmail && (
                  <span className="mcht-website">{c.customerEmail}</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Link href={`/merchants/${c.merchantId}`} className="text-sm text-ink hover:text-teal" onClick={(e) => e.stopPropagation()}>
                {c.merchantName}
              </Link>
            </TableCell>
            <TableCell className="text-xs text-ink-soft whitespace-nowrap">{fmtTime(c.started)}</TableCell>
            <TableCell><Badge variant={statusVariant(c.status)} size="sm">{c.status === "HANDED_OFF" ? "Escalated" : c.status}</Badge></TableCell>
            <TableCell className="font-mono text-sm">{c.messages}</TableCell>
            <TableCell>
              <span className={`font-mono text-xs ${c.aiConfidence >= 90 ? "text-green-600" : c.aiConfidence >= 70 ? "text-amber-600" : "text-red-600"}`}>
                {c.aiConfidence}%
              </span>
            </TableCell>
            <TableCell>
              <div className="flx-center gap-1">
                <div className="hth-dot" style={{ backgroundColor: qualityColor(c.qualityScore) }} />
                <span className="font-mono text-xs">{c.qualityScore}</span>
              </div>
            </TableCell>
            <TableCell className="text-xs text-ink-soft capitalize max-w-[120px] truncate">{c.intent.replace(/_/g, " ")}</TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <td colSpan={8} className="px-4 py-12 text-center text-ink-soft">No conversations found</td>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
