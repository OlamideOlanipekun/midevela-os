"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/Table";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import type { MerchantListItem } from "@/lib/merchant/types";

interface MerchantTableProps {
  items: MerchantListItem[];
  selected: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onLoginAs?: (id: string) => void;
  onSuspend?: (id: string) => void;
  onDelete?: (id: string) => void;
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

const healthColor = (h: number) => h >= 90 ? "#22c55e" : h >= 75 ? "#eab308" : h >= 60 ? "#f97316" : "#ef4444";

function fmtCurrency(n: number): string {
  return n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(1)}M` : `₦${(n / 1_000).toFixed(0)}K`;
}

export function MerchantTable({ items, selected, onSelect, onSelectAll, onLoginAs, onSuspend, onDelete }: MerchantTableProps) {
  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader className="w-10">
            <input type="checkbox" checked={allSelected} onChange={onSelectAll} className="checkbox" />
          </TableHeader>
          <TableHeader>Merchant</TableHeader>
          <TableHeader>Plan</TableHeader>
          <TableHeader>Health</TableHeader>
          <TableHeader>Conversations</TableHeader>
          <TableHeader>Revenue</TableHeader>
          <TableHeader>Status</TableHeader>
          <TableHeader>Created</TableHeader>
          <TableHeader className="w-16"> </TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((m) => (
          <TableRow key={m.id}>
            <TableCell>
              <input type="checkbox" checked={selected.has(m.id)} onChange={() => onSelect(m.id)} className="checkbox" />
            </TableCell>
            <TableCell>
              <Link href={`/merchants/${m.id}`} className="mcht-cell">
                <div className="mcht-avatar">{m.name.charAt(0).toUpperCase()}</div>
                <div className="mcht-info">
                  <span className="mcht-name">{m.name}</span>
                  {m.websiteUrl && <span className="mcht-website">{m.websiteUrl.replace(/^https?:\/\//, "")}</span>}
                </div>
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="outline" size="sm">{m.plan || "—"}</Badge>
            </TableCell>
            <TableCell>
              <div className="flx-center gap-2">
                <div className="hth-dot" style={{ backgroundColor: healthColor(m.health) }} />
                <span className="font-mono text-xs">{m.health}%</span>
              </div>
            </TableCell>
            <TableCell className="font-mono text-sm">{m.conversations.toLocaleString()}</TableCell>
            <TableCell className="font-mono text-sm">{fmtCurrency(m.revenue)}</TableCell>
            <TableCell>
              <Badge variant={statusVariant(m.status)} size="sm">{m.status.replace("_", " ")}</Badge>
            </TableCell>
            <TableCell className="text-xs text-ink-soft whitespace-nowrap">{new Date(m.createdAt).toLocaleDateString()}</TableCell>
            <TableCell>
              <Dropdown trigger={<button className="btn-dots"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg></button>}>
                <DropdownItem onClick={() => window.location.href = `/merchants/${m.id}`}>View</DropdownItem>
                {onLoginAs && <DropdownItem onClick={() => onLoginAs(m.id)}>Login As</DropdownItem>}
                <DropdownSeparator />
                {onSuspend && <DropdownItem onClick={() => onSuspend(m.id)} danger>Suspend</DropdownItem>}
                {onDelete && <DropdownItem onClick={() => onDelete(m.id)} danger>Delete</DropdownItem>}
              </Dropdown>
            </TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <td colSpan={9} className="px-4 py-12 text-center text-ink-soft">No merchants found</td>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
