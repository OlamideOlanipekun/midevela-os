"use client";
import React, { useEffect, useState } from "react";

interface Website {
  id: string;
  merchantName: string;
  normalizedUrl: string;
  originalUrl: string;
  status: string;
  verificationStatus: string;
  crawlStatus: string;
  lastCrawledAt: string | null;
  createdAt: string;
}

const statusColor = (s: string) => {
  switch (s) {
    case "ACTIVE": return "var(--admin-green)";
    case "INACTIVE":
    case "DELETED": return "var(--admin-text-muted)";
    case "SUSPENDED": return "var(--admin-red)";
    default: return "var(--admin-text-soft)";
  }
};

const crawlColor = (s: string) => {
  switch (s) {
    case "READY": return "var(--admin-green)";
    case "CRAWLING":
    case "INDEXING": return "var(--admin-yellow)";
    case "FAILED": return "var(--admin-red)";
    default: return "var(--admin-text-muted)";
  }
};

export default function AdminWebsiteRegistry() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/admin/api/websites")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.websites) setWebsites(d.websites); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = websites.filter((w) =>
    w.normalizedUrl.toLowerCase().includes(search.toLowerCase()) ||
    w.merchantName.toLowerCase().includes(search.toLowerCase())
  );

  const doAction = async (websiteId: string, action: string) => {
    await fetch("/admin/api/websites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteId, action }),
    });
    load();
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString() : "—";

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>Website Registry</h1>
          <p>{websites.length} registered websites</p>
        </div>
        <div className="admin-search">
          <input
            type="text"
            placeholder="Search website or merchant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--admin-text-muted)" }}>
          Loading…
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Website</th>
                <th>Merchant</th>
                <th>Status</th>
                <th>Verification</th>
                <th>Crawl</th>
                <th>Created</th>
                <th>Last Crawl</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--admin-text-muted)", padding: 40 }}>No websites registered yet.</td></tr>
              ) : (
                filtered.map((w) => (
                  <tr key={w.id}>
                    <td style={{ fontFamily: "var(--admin-mono)", fontSize: 12 }}>{w.normalizedUrl}</td>
                    <td>{w.merchantName}</td>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(w.status) }}></span>
                        {w.status}
                      </span>
                    </td>
                    <td>
                      <span className="admin-badge">{w.verificationStatus}</span>
                    </td>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: crawlColor(w.crawlStatus) }}></span>
                        {w.crawlStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>{formatDate(w.createdAt)}</td>
                    <td>{formatDate(w.lastCrawledAt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {w.status === "ACTIVE" && (
                          <button className="admin-btn-sm" style={{ color: "var(--admin-red)" }} onClick={() => doAction(w.id, "suspend")}>Suspend</button>
                        )}
                        {w.status === "SUSPENDED" && (
                          <button className="admin-btn-sm" style={{ color: "var(--admin-green)" }} onClick={() => doAction(w.id, "reactivate")}>Reactivate</button>
                        )}
                        {(w.status === "ACTIVE" || w.status === "SUSPENDED") && (
                          <button className="admin-btn-sm" style={{ color: "var(--admin-red)" }} onClick={() => doAction(w.id, "delete")}>Delete</button>
                        )}
                        {w.status === "INACTIVE" && (
                          <button className="admin-btn-sm" style={{ color: "var(--admin-teal)" }} onClick={() => doAction(w.id, "reactivate")}>Reclaim</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
