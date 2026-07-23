"use client";
import React, { useEffect, useState } from "react";

interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  owner: string;
  aiStatus: string;
  conversations: number;
  createdAt: string;
}

export default function AdminOrganizations() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/organizations")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.organizations) setOrgs(d.organizations);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = orgs.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>Organizations</h1>
          <p>{orgs.length} tenant{orgs.length !== 1 ? "s" : ""} on the platform</p>
        </div>
        <input
          type="text"
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: "var(--admin-bg)", border: "1px solid var(--admin-border)",
            borderRadius: "var(--admin-radius-sm)", padding: "8px 12px",
            color: "var(--admin-text)", fontFamily: "var(--admin-font)", fontSize: 13,
            outline: "none", width: 260,
          }}
        />
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--admin-text-muted)" }}>Loading organizations...</div>
      ) : (
        <div className="admin-card" style={{ marginBottom: 24 }}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>AI Status</th>
                  <th>Conversations</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--admin-text-muted)" }}>No organizations found.</td></tr>
                ) : (
                  filtered.map((org) => (
                    <tr key={org.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: "var(--admin-radius-sm)",
                            background: "var(--admin-primary-tint)", color: "var(--admin-primary)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "var(--admin-mono)", fontSize: 11, fontWeight: 600,
                          }}>{org.name[0]}</div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{org.name}</div>
                            <div style={{ fontFamily: "var(--admin-mono)", fontSize: 11, color: "var(--admin-text-muted)" }}>{org.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: "var(--admin-mono)", fontSize: 12 }}>{org.plan}</td>
                      <td>
                        <span style={{
                          fontFamily: "var(--admin-mono)", fontSize: 11, padding: "2px 8px",
                          borderRadius: 999,
                          background: org.status === "active" ? "var(--admin-green-tint)" : "var(--admin-red-tint)",
                          color: org.status === "active" ? "var(--admin-green)" : "var(--admin-red)",
                        }}>{org.status}</span>
                      </td>
                      <td>{org.owner}</td>
                      <td>
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%", display: "inline-block",
                          background: org.aiStatus === "online" ? "var(--admin-green)" : "var(--admin-text-muted)",
                          marginRight: 6,
                        }}></span>
                        {org.aiStatus}
                      </td>
                      <td style={{ fontFamily: "var(--admin-mono)", fontSize: 12 }}>{org.conversations.toLocaleString()}</td>
                      <td style={{ fontFamily: "var(--admin-mono)", fontSize: 11, color: "var(--admin-text-muted)" }}>{org.createdAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && (
        <div style={{ display: "flex", gap: 12 }}>
          <button className="admin-login-btn" style={{ padding: "8px 16px", fontSize: 11 }}>Export CSV</button>
          <button className="admin-login-btn" style={{ padding: "8px 16px", fontSize: 11, background: "transparent", border: "1px solid var(--admin-border)", color: "var(--admin-text)" }}>View Suspended</button>
        </div>
      )}
    </div>
  );
}
