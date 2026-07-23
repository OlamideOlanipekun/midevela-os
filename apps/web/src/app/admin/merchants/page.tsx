"use client";
import React, { useEffect, useState } from "react";

interface Merchant {
  id: string;
  name: string;
  email: string;
  orgName: string;
  role: string;
  status: string;
  plan: string;
  conversations: number;
  lastSeen: string;
  createdAt: string;
}

export default function AdminMerchants() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Merchant | null>(null);

  useEffect(() => {
    fetch("/api/admin/merchants")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.merchants) setMerchants(d.merchants);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = merchants.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.orgName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>Merchants</h1>
          <p>{merchants.length} user{merchants.length !== 1 ? "s" : ""} across all organizations</p>
        </div>
        <input
          type="text"
          placeholder="Search merchants..."
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
        <div style={{ padding: 40, textAlign: "center", color: "var(--admin-text-muted)" }}>Loading merchants...</div>
      ) : (
        <div className="admin-card" style={{ marginBottom: 24 }}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Organization</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Plan</th>
                  <th>Conversations</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--admin-text-muted)" }}>No merchants found.</td></tr>
                ) : (
                  filtered.map((m) => (
                    <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => setSelected(m)}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: "50%",
                            background: "linear-gradient(135deg, var(--admin-primary), #6366f1)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontFamily: "var(--admin-mono)", fontSize: 10, fontWeight: 600,
                          }}>{m.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}</div>
                          <span style={{ fontWeight: 600 }}>{m.name}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: "var(--admin-mono)", fontSize: 12, color: "var(--admin-text-soft)" }}>{m.email}</td>
                      <td>{m.orgName}</td>
                      <td style={{ fontFamily: "var(--admin-mono)", fontSize: 11, color: "var(--admin-text-muted)" }}>{m.role}</td>
                      <td>
                        <span style={{
                          fontFamily: "var(--admin-mono)", fontSize: 11, padding: "2px 8px", borderRadius: 999,
                          background: m.status === "active" ? "var(--admin-green-tint)" : m.status === "suspended" ? "var(--admin-red-tint)" : "var(--admin-yellow-tint)",
                          color: m.status === "active" ? "var(--admin-green)" : m.status === "suspended" ? "var(--admin-red)" : "var(--admin-yellow)",
                        }}>{m.status}</span>
                      </td>
                      <td style={{ fontFamily: "var(--admin-mono)", fontSize: 12 }}>{m.plan}</td>
                      <td style={{ fontFamily: "var(--admin-mono)", fontSize: 12 }}>{m.conversations.toLocaleString()}</td>
                      <td style={{ fontFamily: "var(--admin-mono)", fontSize: 11, color: "var(--admin-text-muted)" }}>{m.lastSeen}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="admin-card">
          <div className="admin-card-head">
            <h3>{selected.name}</h3>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--admin-text-muted)", cursor: "pointer", fontFamily: "var(--admin-mono)", fontSize: 11 }}>Close</button>
          </div>
          <div className="admin-card-body">
            <div className="admin-grid-2">
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "var(--admin-mono)", fontSize: 10, color: "var(--admin-text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Account</div>
                  <div style={{ fontSize: 13 }}><strong>Email:</strong> {selected.email}</div>
                  <div style={{ fontSize: 13 }}><strong>Role:</strong> {selected.role}</div>
                  <div style={{ fontSize: 13 }}><strong>Organization:</strong> {selected.orgName}</div>
                  <div style={{ fontSize: 13 }}><strong>Plan:</strong> {selected.plan}</div>
                  <div style={{ fontSize: 13 }}><strong>Status:</strong> {selected.status}</div>
                </div>
              </div>
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "var(--admin-mono)", fontSize: 10, color: "var(--admin-text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Activity</div>
                  <div style={{ fontSize: 13 }}><strong>Conversations:</strong> {selected.conversations.toLocaleString()}</div>
                  <div style={{ fontSize: 13 }}><strong>Last seen:</strong> {selected.lastSeen}</div>
                  <div style={{ fontSize: 13 }}><strong>Joined:</strong> {selected.createdAt}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="admin-login-btn" style={{ padding: "6px 14px", fontSize: 11, background: "transparent", border: "1px solid var(--admin-border)", color: "var(--admin-text)" }}>Login As</button>
                  <button className="admin-login-btn" style={{ padding: "6px 14px", fontSize: 11, background: "var(--admin-red-tint)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--admin-red)" }}>Suspend</button>
                  <button className="admin-login-btn" style={{ padding: "6px 14px", fontSize: 11, background: "var(--admin-red-tint)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--admin-red)" }}>Delete</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
