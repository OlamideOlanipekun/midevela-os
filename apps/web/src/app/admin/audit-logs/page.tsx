"use client";
import React, { useState } from "react";

interface Log {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  timestamp: string;
}

const sampleLogs: Log[] = [
  { id: "1", action: "org.created", actor: "admin@midevela.com", target: "Kind Store", detail: "Organization created with starter plan", timestamp: "2m ago" },
  { id: "2", action: "user.suspended", actor: "admin@midevela.com", target: "john@botanica.com", detail: "Suspended for payment failure", timestamp: "15m ago" },
  { id: "3", action: "knowledge.uploaded", actor: "merchant@botanica.com", target: "Botanica", detail: "24 documents indexed", timestamp: "25m ago" },
  { id: "4", action: "billing.updated", actor: "system", target: "XYZ Fashion", detail: "Plan upgraded to Growth", timestamp: "1h ago" },
  { id: "5", action: "ai.prompt.changed", actor: "merchant@lumina.com", target: "Lumina Beauty", detail: "Greeting prompt updated", timestamp: "2h ago" },
];

export default function AdminAuditLogs() {
  const [search, setSearch] = useState("");

  const filtered = sampleLogs.filter((l) =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.actor.toLowerCase().includes(search.toLowerCase()) ||
    l.target.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>Audit Logs</h1>
          <p>Every action across the platform, searchable.</p>
        </div>
        <input type="text" placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} style={{
          background: "var(--admin-bg)", border: "1px solid var(--admin-border)",
          borderRadius: "var(--admin-radius-sm)", padding: "8px 12px",
          color: "var(--admin-text)", fontFamily: "var(--admin-font)", fontSize: 13, outline: "none", width: 260,
        }} />
      </div>
      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Detail</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: "var(--admin-mono)", fontSize: 12 }}><span style={{ color: "var(--admin-primary)" }}>{log.action}</span></td>
                  <td style={{ fontFamily: "var(--admin-mono)", fontSize: 12, color: "var(--admin-text-soft)" }}>{log.actor}</td>
                  <td>{log.target}</td>
                  <td style={{ color: "var(--admin-text-soft)" }}>{log.detail}</td>
                  <td style={{ fontFamily: "var(--admin-mono)", fontSize: 11, color: "var(--admin-text-muted)" }}>{log.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
