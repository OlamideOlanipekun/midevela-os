"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/Table";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import type { WebsiteListItem } from "@/lib/websites/types";

interface WebsiteTableProps {
  items: WebsiteListItem[];
  onSuspend?: (id: string) => void;
  onDelete?: (id: string) => void;
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

const crawlDot = (s: string) => {
  const c = s === "READY" ? "dot-green" : s === "CRAWLING" || s === "INDEXING" ? "dot-yellow" : s === "FAILED" ? "dot-red" : "dot-yellow";
  return <span className={`status-dot ${c}`} />;
};

const sslDot = (s: string) => {
  const c = s === "valid" ? "dot-green" : s === "unknown" ? "dot-yellow" : "dot-red";
  return <span className={`status-dot ${c}`} />;
};

export function WebsiteTable({ items, onSuspend, onDelete }: WebsiteTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Website</TableHeader>
          <TableHeader>Merchant</TableHeader>
          <TableHeader>Health</TableHeader>
          <TableHeader>Crawler</TableHeader>
          <TableHeader>Products</TableHeader>
          <TableHeader>Pages</TableHeader>
          <TableHeader>SSL</TableHeader>
          <TableHeader>Status</TableHeader>
          <TableHeader className="w-16"> </TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((w) => (
          <TableRow key={w.id}>
            <TableCell>
              <Link href={`/websites/${w.id}`} className="mcht-cell">
                <div className="mcht-avatar">{w.domain.charAt(0).toUpperCase()}</div>
                <div className="mcht-info">
                  <span className="mcht-name font-mono text-sm">{w.domain}</span>
                </div>
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/merchants/${w.merchantId}`} className="text-sm text-ink hover:text-teal transition-colors">
                {w.merchantName}
              </Link>
            </TableCell>
            <TableCell>
              <div className="flx-center gap-2">
                <div className="hth-dot" style={{ backgroundColor: w.health >= 80 ? "#22c55e" : w.health >= 55 ? "#eab308" : "#ef4444" }} />
                <span className="font-mono text-xs">{w.health}%</span>
              </div>
            </TableCell>
            <TableCell>
              <span className="flx-center gap-1">
                {crawlDot(w.crawlStatus)}
                <span className="text-xs">{w.crawlStatus.replace(/_/g, " ")}</span>
              </span>
            </TableCell>
            <TableCell className="font-mono text-sm">{w.products.toLocaleString()}</TableCell>
            <TableCell className="font-mono text-sm">{w.pages.toLocaleString()}</TableCell>
            <TableCell>{sslDot(w.sslStatus)}</TableCell>
            <TableCell><Badge variant={statusVariant(w.status)} size="sm">{w.status}</Badge></TableCell>
            <TableCell>
              <Dropdown trigger={<button className="btn-dots"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg></button>}>
                <DropdownItem onClick={() => window.location.href = `/websites/${w.id}`}>View</DropdownItem>
                <DropdownSeparator />
                {onSuspend && <DropdownItem onClick={() => onSuspend(w.id)} danger>Suspend</DropdownItem>}
                {onDelete && <DropdownItem onClick={() => onDelete(w.id)} danger>Delete</DropdownItem>}
              </Dropdown>
            </TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <td colSpan={9} className="px-4 py-12 text-center text-ink-soft">No websites registered</td>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
